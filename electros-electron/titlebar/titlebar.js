import {getDefaultGlassmorphismColor} from "../electros/js/gui/backgrounds/ColourUtils";

function initializeTitlebar(options = { minimizeOnly: false }) {
    const titlebar = document.querySelector('.electros-titlebar');
    const platform = navigator.userAgent.includes('Mac') ? 'mac' :
        navigator.userAgent.includes('Win') ? 'win' :
            'linux';

    titlebar.classList.add(platform);

    const buttonsAlignClass = platform === 'mac' ? 'electros-titlebar-buttons-align-left' : 'electros-titlebar-buttons-align-right';

    if (platform === 'mac') {
        titlebar.innerHTML = `
            <div class='electros-titlebar-buttons ${buttonsAlignClass}'>
                ${options.minimizeOnly ? `
                    <button class='electros-titlebar-button' id='minimize-button' tabindex="-1"></button>
                    <button class='electros-titlebar-button' id='hide-button' tabindex="-1"></button>
                ` : `
                    <button class='electros-titlebar-button' id='close-button' tabindex="-1"></button>
                    <button class='electros-titlebar-button' id='minimize-button' tabindex="-1"></button>
                    <button class='electros-titlebar-button' id='maximize-button' tabindex="-1"></button>
                    <button class='electros-titlebar-button' id='fullscreen-button' tabindex="-1"></button>
                `}
            </div>
        `;
    } else {
        titlebar.innerHTML = `
            <div class='electros-titlebar-buttons ${buttonsAlignClass}'>
                <button class='electros-titlebar-button' id='minimize-button' tabindex="-1"></button>
                ${!options.minimizeOnly ? `
                    <button class='electros-titlebar-button' id='maximize-button' tabindex="-1"></button>
                    <button class='electros-titlebar-button' id='close-button' tabindex="-1"></button>
                ` : ''}
            </div>
        `;
    }

    const buttonActions = {
        'close-button': 'close-window',
        'hide-button': 'hide-window',
        'minimize-button': 'minimize-window',
        'maximize-button': 'toggle-full-screen',
        'fullscreen-button': 'maximize-window',
    };

    Object.entries(buttonActions).forEach(([buttonId, action]) => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.addEventListener('click', () => {
                window.electron.invoke(action);
            });
        }
    });
}


window.titlebar = {
    setContent: (element) => {
        element.dataset.element = "titlebar-content";
        document.querySelector('[data-element="titlebar-content"]').replaceWith(element);
    },
    setHeight: (height = window.titlebar.defaultHeight) => {
        document.body.style.setProperty("--titlebar-height", `${height}px`);
    },
    defaultHeight: 34
}

