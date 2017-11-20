/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cyril Soulliage. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
    IPCMessageReader, IPCMessageWriter, createConnection, IConnection, TextDocuments,
    TextDocument, Diagnostic, DiagnosticSeverity, InitializeResult,
    TextDocumentChangeEvent, Files
} from 'vscode-languageserver';

import * as url from "url";
import fs = require("fs");
import path = require("path");
import cp = require("child_process");

class TwigcsServer {

    private connection: IConnection;
    private documents: TextDocuments;
    // private maxNumberOfProblems: number;

    private _validating: { [uri: string]: TextDocument };

    /**
     * Class constructor.
     *
     * @return A new instance of the server.
     */
    constructor() {
        this._validating = Object.create(null);

        // Create a connection for the server. The connection uses Node's IPC as a transport
        this.connection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

        // Create a simple text document manager. The text document managerc supports full document sync only
        this.documents = new TextDocuments();

        // Make the text document manager listen on the connection for open, change and close text document events
        this.documents.listen(this.connection);

        this.connection.onInitialize(() => {
            return this.onInitialize();
        });
        this.connection.onDidChangeConfiguration(() => {
            this.onDidChangeConfiguration();
        });
        // this.connection.onDidChangeWatchedFiles((params) => {
        //     this.onDidChangeWatchedFiles(params);
        // });
        this.documents.onDidOpen((event) => {
            this.onDidOpenDocument(event);
        });
        this.documents.onDidChangeContent((event) => {
            this.onDidChangeContent(event);
        });
        this.documents.onDidSave((event) => {
            this.onDidSaveDocument(event);
        });
        this.documents.onDidClose((event) => {
            this.onDidCloseDocument(event);
        });
    }

    /**
     * Handles server initialization.
     *
     * @param params The initialization parameters.
     * @return A promise of initialization result or initialization error.
     */
    private onInitialize() : InitializeResult {
        return {
            capabilities: {
                // Tell the client that the server works in FULL text document sync mode
                textDocumentSync: this.documents.syncKind,
                // Tell the client that the server support code complete
                // completionProvider: {
                //     resolveProvider: true
                // }
            }
        };
    }

    // connection.onDidChangeWatchedFiles((_change) => {
    //     // Monitored files have change in VSCode
    //     connection.console.log('We recevied an file change event');
    // });

    /**
     * Handles opening of text documents.
     *
     * @param event The text document change event.
     * @return void
     */
    private onDidOpenDocument(event: TextDocumentChangeEvent ) : void {
        this.twigcsDiagnostic(event.document);
    }

    /**
     * Handles text document changes.
     *
     * @param params The changed configuration parameters.
     * @return void
     */
    private onDidChangeContent(event: TextDocumentChangeEvent): void {
        this.twigcsDiagnostic(event.document);
    }

    /**
     * Handles saving of text documents.
     *
     * @param event The text document change event.
     * @return void
     */
    private onDidSaveDocument(event: TextDocumentChangeEvent ) : void {
        this.twigcsDiagnostic(event.document);
    }

    /**
     * Handles closing of text documents. TODO : understand
     *
     * @param event The text document change event.
     * @return void
     */
    private onDidCloseDocument(event: TextDocumentChangeEvent ) : void {
        this.connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
    }

    /**
     * The settings have changed. Is send on server activation as well.
     *
     * @return void
     */
    private onDidChangeConfiguration(): void {
        // this.maxNumberOfProblems = 100;
        // Revalidate any open text documents
        this.documents.all().forEach(this.twigcsDiagnostic);
    }

	/**
	 * Show an error message.
	 *
	 * @param message The message to show.
	 */
	private showErrorMessage(message: string): void {
		this.connection.window.showErrorMessage(`[twigcs] ${message}`);
	}

    /**
     * Start listening to requests.
     *
     * @return void
     */
    public listen(): void {
        this.connection.listen();
    }

    /**
     * Start a Twig Diagnostic.
     *
     * @return void
     */
    private twigcsDiagnostic(document: TextDocument): void {
        let options = null;
        let docUrl = url.parse(document.uri);
        let diagnostics: Diagnostic[] = [];

        // Process linting paths.
        let filePath = Files.uriToFilePath(document.uri);

		// Make sure we capitalize the drive letter in paths on Windows.
		if (filePath !== undefined && /^win/.test(process.platform)) {
			let pathRoot: string = path.parse(filePath).root;
			let noDrivePath = filePath.slice(Math.max(pathRoot.length - 1, 0));
			filePath = path.join(pathRoot.toUpperCase(), noDrivePath);
		}

        if (docUrl.protocol == "file:" && this._validating[document.uri] === undefined) {
            let resolvedPath = this.resolveTwigcsPath();
            if (resolvedPath) {
                let commandLine = resolvedPath + ` lint ${filePath}`;

                cp.exec(commandLine, options, (error, stdout, stderr) => {
                    if (error) {
                        // this.showErrorMessage(`#1 : ${error}`);
                    }
                    if (stdout) {
                        diagnostics = this.validateText(stdout);
                    }
                    if (stderr) {
                        this.showErrorMessage(`${stderr}`);
                    }

                    // Send the computed diagnostics to VSCode
                    this.connection.sendDiagnostics({ uri: document.uri, diagnostics});
                });
            } else {
                this.showErrorMessage(`The 'twigcs' dependency was not found. You may need to update your dependencies using "composer global require allocine/twigcs".`);
            }
        }
    }

    /**
     * Convert twigcs diagnostic from allocine for vscode diagnostic.
     *
     * @param text The text diagnostic from twigcs.
     * @return diagnostics Diagnostic[]
     */
    private validateText(text: string): Diagnostic[] {
        let diagnostics: Diagnostic[] = [];
        let lines = text.split(/\r?\n/g);
        let match = null;

        for (var i = 0; i < lines.length; i++) {
            let line = lines[i];
            // https://regex101.com/r/t0L71V/3
            if (match = line.match(/^l.([0-9]+) c.([0-9]+) : (ERROR|WARNING|INFO) ([0-9a-zA-Z ():"|]+\.)$/i)) {
                let line = Number(match[1].trim()) - 1;
                let column = Number(match[2].trim()) - 1;
                let type = match[3].trim();
                let message = match[4].trim();

                let severity: DiagnosticSeverity = DiagnosticSeverity.Information;
                if (type === 'ERROR') {
                    severity = DiagnosticSeverity.Error
                } else if (type === 'WARNING') {
                    severity = DiagnosticSeverity.Warning
                }

                diagnostics.push({
                    severity: severity,
                    range: {
                        start: { line: line, character: column },
                        end: { line: line, character: column + 1 }
                    },
                    message: `${message}`,
                    source: 'twigcs'
                });
            }
        }

        return diagnostics;
    }

    /**
     * Solves Twigcs path.
     *
     * @return string Twigcs path.
     */
    private resolveTwigcsPath(): string {
        let resolvedPath = null;
        let twigcsExecutableFile = `twigcs`;
        let pathSeparator = /^win/.test(process.platform) ? ";" : ":";
        let globalPaths: string[] = process.env.PATH.split(pathSeparator);
        globalPaths.some((globalPath: string) => {
            let testPath = path.join( globalPath, twigcsExecutableFile );
            if (fs.existsSync(testPath)) {
                resolvedPath = testPath;
                return true;
            }
            return false;
        });
        return resolvedPath;
    }

}

let server = new TwigcsServer();
server.listen();
