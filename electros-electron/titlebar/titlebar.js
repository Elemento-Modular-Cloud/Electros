function initializeTitlebar() {
    console.log('Electron is defined');
    const titlebar = document.querySelector('.electros-titlebar');
    const platform = navigator.userAgent.includes('Mac') ? 'mac' : 
                     navigator.userAgent.includes('Win') ? 'win' :
                     'linux';


    titlebar.classList.add(platform);

    const buttonsAlignClass = platform === 'mac' ? 'titlebar-buttons-align-left' : 'titlebar-buttons-align-right';
    if (platform === 'mac') {
        titlebar.innerHTML = `
            <div class='electros-titlebar-buttons ${buttonsAlignClass}'>
                <button class='electros-titlebar-button' id='close-button'></button>
                <button class='electros-titlebar-button' id='minimize-button'></button>
                <button class='electros-titlebar-button' id='maximize-button'></button>
                <button class='electros-titlebar-button' id='fullscreen-button'></button>
            </div>
        `;
    } else {
        titlebar.innerHTML = `
            <div class='electros-titlebar-buttons ${buttonsAlignClass}'>
                <button class='electros-titlebar-button' id='minimize-button'></button>
                <button class='electros-titlebar-button' id='maximize-button'></button>
                <button class='electros-titlebar-button' id='close-button'></button>
            </div>
        `;
    }

    const buttonActions = {
        'close-button': 'close-window',
        'minimize-button': 'minimize-window',
        'maximize-button': 'toggle-full-screen',
        'fullscreen-button': 'maximize-window',
    };

    Object.entries(buttonActions).forEach(([buttonId, action]) => {
        document.getElementById(buttonId).addEventListener('click', () => {
            window.electron.invoke(action);
        });
    });
}
