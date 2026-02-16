import {
  ILabShell,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { IMainMenu } from '@jupyterlab/mainmenu';
import {
  Dialog,
  ISplashScreen,
  IThemeManager,
  showDialog
} from '@jupyterlab/apputils';
import { ITranslator } from '@jupyterlab/translation';
import {
  jupyterFaviconIcon,
  jupyterIcon
 } from '@jupyterlab/ui-components';
import { DisposableDelegate } from '@lumino/disposable';
import { Throttler } from '@lumino/polling';
import { Widget } from '@lumino/widgets';

// Import logos
import ardcLogoUrl from '../style/images/ardc-logo.svg';
import nectarLogoUrl from '../style/images/nectar-logo.svg';
import nectarLogoAnimatedUrl from '../style/images/nectar-logo-animated.svg';

/**
 * The interval in milliseconds before recover options appear during splash.
 */
const SPLASH_RECOVER_TIMEOUT = 12000;

/**
 * The command IDs used by the apputils plugin.
 */
namespace CommandIDs {
  export const loadState = 'apputils:load-statedb';
  export const print = 'apputils:print';
  export const reset = 'apputils:reset';
  export const resetOnLoad = 'apputils:reset-on-load';
  export const runFirstEnabled = 'apputils:run-first-enabled';
  export const runAllEnabled = 'apputils:run-all-enabled';
  export const toggleHeader = 'apputils:toggle-header';
}

/**
 * The Nectar splash screen provider.
 */
const splash: JupyterFrontEndPlugin<ISplashScreen> = {
  id: '@nectar/jupyterlab-theme:splash',
  autoStart: true,
  requires: [ITranslator],
  provides: ISplashScreen,
  activate: (app: JupyterFrontEnd, translator: ITranslator) => {
    const trans = translator.load('jupyterlab');
    const { commands, restored } = app;

    // Create splash element and populate it.
    const splash = document.createElement('div');
    const logo = document.createElement('div');

    splash.id = 'jupyterlab-splash';
    logo.id = 'main-logo';

    jupyterFaviconIcon.element({
      container: logo,
      stylesheet: 'splash'
    });

    logo.innerHTML = nectarLogoAnimatedUrl;

    splash.appendChild(logo);

    // Create debounced recovery dialog function.
    let dialog: Dialog<unknown> | null;
    const recovery = new Throttler(
      async () => {
        if (dialog) {
          return;
        }

        dialog = new Dialog({
          title: trans.__('Loading…'),
          body: trans.__(`The loading screen is taking a long time.
Would you like to clear the workspace or keep waiting?`),
          buttons: [
            Dialog.cancelButton({ label: trans.__('Keep Waiting') }),
            Dialog.warnButton({ label: trans.__('Clear Workspace') })
          ]
        });

        try {
          const result = await dialog.launch();
          dialog.dispose();
          dialog = null;
          if (result.button.accept && commands.hasCommand(CommandIDs.reset)) {
            return commands.execute(CommandIDs.reset);
          }

          // Re-invoke the recovery timer in the next frame.
          requestAnimationFrame(() => {
            // Because recovery can be stopped, handle invocation rejection.
            void recovery.invoke().catch(_ => undefined);
          });
        } catch (error) {
          /* no-op */
        }
      },
      { limit: SPLASH_RECOVER_TIMEOUT, edge: 'trailing' }
    );

    // Return ISplashScreen.
    let splashCount = 0;
    return {
      show: (light = true) => {
        splash.classList.remove('splash-fade');
        //splash.classList.toggle('light', light);
        //splash.classList.toggle('dark', !light);
        splashCount++;
        document.body.appendChild(splash);

        // Because recovery can be stopped, handle invocation rejection.
        void recovery.invoke().catch(_ => undefined);

        return new DisposableDelegate(async () => {
          await restored;
          if (--splashCount === 0) {
            void recovery.stop();

            if (dialog) {
              dialog.dispose();
              dialog = null;
            }

            splash.classList.add('splash-fade');
            window.setTimeout(() => {
              document.body.removeChild(splash);
            }, 2000);
          }
        });
      }
    };
  }
};


/**
 * The Nectar logos
 */
const logo: JupyterFrontEndPlugin<void> = {
  id: '@nectar/jupyterlab-theme:logo',
  requires: [IThemeManager],
  optional: [ILabShell],
  activate: (app: JupyterFrontEnd, manager: IThemeManager, _shell: ILabShell | null) => {
    const style = '@nectar/jupyterlab-theme/index.css';

    // Wait for the app to be fully restored before setting icons
    void app.restored.then(() => {
      // Set the JupyterLab icons to use Nectar branding
      // Note: We only change favicon and toolbar icon, NOT wordmark
      // This keeps the default JupyterLab About dialog with its original branding
      jupyterFaviconIcon.svgstr = nectarLogoUrl;
      jupyterIcon.svgstr = nectarLogoUrl;
      // jupyterlabWordmarkIcon.svgstr = nectarLogoUrl; // Keep original for JupyterLab About

      console.log('Nectar icons updated after app restored');

      // Update the favicon in the DOM
      const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (favicon) {
        const svgBlob = new Blob([nectarLogoUrl], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(svgBlob);
        favicon.href = url;      }
    });

    // Register the theme
    manager.register({
      name: 'Nectar',
      isLight: true,
      themeScrollbars: true,
      load: () => manager.loadCSS(style),
      unload: () => Promise.resolve(undefined)
    });

    console.log('JupyterLab extension @nectar/jupyterlab-theme is activated!');
  },
  autoStart: true
};

/**
 * The Nectar About dialog
 */
const about: JupyterFrontEndPlugin<void> = {
  id: '@nectar/jupyterlab-theme:about',
  autoStart: true,
  requires: [IMainMenu],
  activate: (app: JupyterFrontEnd, mainMenu: IMainMenu) => {
    const { commands } = app;
    const aboutUrl = 'https://support.ehelp.edu.au/a/solutions/articles/6000261095';

    // Add command for Nectar About dialog
    const command = 'nectar:about';
    commands.addCommand(command, {
      label: 'About ARDC Nectar Jupyter Notebook Service',
      execute: () => {
        // Create dialog body
        const body = document.createElement('div');
        body.className = 'jp-About';
        body.style.padding = '20px';

        // Add ARDC logo (inline SVG, center-aligned)
        const ardcLogoDiv = document.createElement('div');
        ardcLogoDiv.innerHTML = ardcLogoUrl;
        ardcLogoDiv.style.maxWidth = '300px';
        ardcLogoDiv.style.marginBottom = '20px';
        ardcLogoDiv.style.marginLeft = 'auto';
        ardcLogoDiv.style.marginRight = 'auto';
        // Style the SVG element inside
        const ardcSvg = ardcLogoDiv.querySelector('svg');
        if (ardcSvg) {
          ardcSvg.style.width = '100%';
          ardcSvg.style.height = 'auto';
        }
        body.appendChild(ardcLogoDiv);

        // Add link (left-aligned)
        const link = document.createElement('a');
        link.className = 'jp-About-externalLinks';
        link.href = aboutUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Help about the ARDC Nectar Jupyter Notebook Service';
        link.style.display = 'block';
        link.style.marginBottom = '20px';
        body.appendChild(link);

        return showDialog({
          title: 'ARDC Nectar Jupyter Notebook Service',
          body: new Widget({ node: body }),
          buttons: [Dialog.okButton()]
        });
      }
    });

    // Add to Help menu as the first group (rank 0) to appear at the top
    mainMenu.helpMenu.addGroup([{ command }], 0);
  }
};

/**
 * Export the plugins as default.
 */
const plugins: JupyterFrontEndPlugin<any>[] = [
  logo,
  splash,
  about
];
export default plugins;
