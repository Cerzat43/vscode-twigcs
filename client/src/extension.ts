/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cyril Soulliage. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as path from 'path';
import { TwigcsStatus } from './status';

import { workspace, ExtensionContext } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

export function activate(context: ExtensionContext) {
  // The server is implemented in node
  let serverModule = context.asAbsolutePath(path.join('server', 'server.js'));

  // The debug options for the server
  let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  let serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions },
  };

  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [{ scheme: 'file', language: 'twig' }],
    synchronize: {
      // Synchronize the setting section 'languageServerExample' to the server
      configurationSection: 'twigcs',
      // Notify the server about file changes to '.clientrc files contain in the workspace
      fileEvents: workspace.createFileSystemWatcher('**/.clientrc'),
    },
  };

  // Create the language client and start the client.
  let client = new LanguageClient('TWIG CodeSniffer Linter', serverOptions, clientOptions);

  let status = new TwigcsStatus();
  status.infoApp();

  // Start the client
  client.start();
  context.subscriptions.push(client);
  context.subscriptions.push(status);
}
