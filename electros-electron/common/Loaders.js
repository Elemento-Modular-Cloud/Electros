import fs from "fs";
import path from "path";


export class Loaders {
    Css = {
        Themes: null,
        FormControl: null,
        Titlebar: null
    }

    Js = {
        Titlebar: null,
        Themes: null,
        FormStyle: null
    }

    constructor(__dirname) {
        try {
            this.Css.Titlebar = fs.readFileSync(path.join(__dirname, 'titlebar', 'titlebar.css'), 'utf8');
            const titlebarTempJs = fs.readFileSync(path.join(__dirname, 'titlebar', 'titlebar.js'), 'utf8');
            this.Css.Themes = fs.readFileSync(path.join(__dirname, 'elemento-gui-new', 'electros', 'css', 'themes.css'), 'utf8');
            this.Css.FormControl = fs.readFileSync(path.join(__dirname, 'elemento-gui-new', 'electros', 'css', 'form-controls.css'), 'utf8');

            this.Js.Themes = `
            var theme = document.createElement('style');
            theme.textContent = ${JSON.stringify(this.Css.Themes || '')};
            document.head.appendChild(theme);
            `;

            this.Js.FormStyle = `
            var formstyle = document.createElement('style');
            formstyle.textContent = ${JSON.stringify(this.Css.FormControl || '')};
            document.head.appendChild(formstyle);
            `;

            this.Js.Titlebar = `
            ${this.Js.Themes}
            ${this.Js.FormControl}

            var style = document.createElement('style');
            style.textContent = ${JSON.stringify(this.Css.Titlebar || '')};
            document.head.appendChild(style);

            // Create titlebar div and title element
            var titlebar = document.createElement('div');
            titlebar.className = 'electros-titlebar';

            var titleElement = document.createElement('div');
            titleElement.className = 'electros-titlebar-title';
            titleElement.textContent = document.title;

            document.body.insertBefore(titlebar, document.body.firstChild);

            // Load and execute titlebar.js content
            ${titlebarTempJs}

            initializeTitlebar(options = { minimizeOnly: false });

            titlebar.appendChild(titleElement);
            `;
        } catch (e) {
            console.error(e);
            throw e;
        }
    }
}
