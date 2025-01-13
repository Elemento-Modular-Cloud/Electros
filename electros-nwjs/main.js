const gui = require('nw.gui');

// Create window with the same settings as package.json
const win = gui.Window.open('electros/electros.html', {
    width: 1800,
    height: 1200,
    frame: true,
    toolbar: true
});

// Optional: Handle window events
win.on('loaded', function() {
    console.log('Window loaded');
});