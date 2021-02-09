import * as LocalMain from '@getflywheel/local/main';
import { IPC_EVENTS } from '../constants';
import { BrowserWindow } from 'electron';
import path from 'path';

let terminalWindows: {[key: string]: BrowserWindow} = {};

let terminalOutput: {[key: string]: string[]} = {};

// @todo-tyler update the type from 'any' to 'child process' here
let childProcesses: {[key: string]: any} = {};


/*
 * logs all terminal output to string array in the terminalOutput object
 */
export const logTerminalOutputBySiteID = (siteID: string, data: string): void => {
	if (!terminalOutput[siteID]) {
		terminalOutput = {
			...terminalOutput,
			[siteID]: [],
		};
	}

	terminalOutput[siteID].push(data);
};

/*
 * adds electron window by site id to terminalWindows object
 */
export const registerBrowserWindowBySiteID = (siteID: string, window: BrowserWindow): void => {
	if (terminalWindows[siteID]) {
		return;
	}

	terminalWindows = {
		...terminalWindows,
		[siteID]: window,
	};
};


/*
 * deletes browser window from terminalWindows object
 */
export const deregisterBrowserWindowBySiteID = (siteID: string): void => {
	if (!terminalWindows[siteID]) {
		return;
	}

	delete terminalWindows[siteID];
};

/*
 * adds node process by site id to childProcesses object
 */
export const registerNodeProcess = (siteID: string, process: LocalMain.Process): void => {
	if (childProcesses[siteID]) {
		return;
	}

	childProcesses = {
		...childProcesses,
		[siteID]: process.childProcess,
	};
};

/*
 * deletes node process from childProcesses object
 */
export const deregisterNodeProcess = (siteID: string): void => {
	if (!childProcesses[siteID]) {
		return;
	}

	delete childProcesses[siteID];
};

/*
 * creates a new electron window to display xterm component
 */
export const createNewTerminalWindow = (siteID: string): BrowserWindow => {
	if (terminalWindows[siteID]) {
		return terminalWindows[siteID];
	}

	const terminalWindow = new BrowserWindow({
		acceptFirstMouse: true,
		show: false,
		useContentSize: true,
		webPreferences: {
			nodeIntegration: true,
			enableRemoteModule: true,
		},
	});

	terminalWindow.webContents.on('will-navigate', (event) => {
		event.preventDefault();
	});

	terminalWindow.webContents.on('new-window', (event) => {
		event.preventDefault();
	});

	// hide terminal window instead of close, as this allows us to persist output
	terminalWindow.on('close', (event) => {
		event.preventDefault();
		terminalWindow.hide();
	});

	terminalWindow.loadFile(path.resolve(__dirname, '../../src/renderer/_browserWindows/xterm.html'));

	return terminalWindow;
};

/*
 * connects terminal window to node process output
 */
export const connectTerminalOutput = (siteID: string, processes: LocalMain.Process[]): void => {

	for (const process of processes) {
		if (process.name === 'nodejs') {
			const win = createNewTerminalWindow(siteID);
			registerBrowserWindowBySiteID(siteID, win);
			registerNodeProcess(siteID, process);
		}
	}

	if (terminalWindows[siteID]) {
		childProcesses[siteID].stdout?.on('data', (data) => {
			terminalWindows[siteID].webContents.send(IPC_EVENTS.WRITE_XTERM, data.toString());
		});

		childProcesses[siteID].stderr?.on('data', (data) => {
			terminalWindows[siteID].webContents.send(IPC_EVENTS.WRITE_XTERM, data.toString());
		});
	}
};

/*
 * opens the terminal window from the render thread
 * called by IPC event when clicking "show output"
 */
export const openTerminal = (siteID: string): void => {

	if (!terminalWindows[siteID]) {
		return;
	}

	terminalWindows[siteID].show();
};

/*
 * clears specific terminal window of all output
 */
export const clearTerminal = (siteID: string): void => {

	if (!terminalWindows[siteID]) {
		return;
	}

	terminalWindows[siteID].webContents.send(IPC_EVENTS.CLEAR_XTERM);
};
