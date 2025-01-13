#! /bin/bash

mkdir -p dist/mac-arm64
cp -r nwjs.app dist/mac-arm64/electros.app

mkdir -p dist/mac-arm64/electros.app/Contents/Resources/app.nw
cp -r package.json dist/mac-arm64/electros.app/Contents/Resources/app.nw
cp -r electros dist/mac-arm64/electros.app/Contents/Resources/app.nw
cp -r utilities.js dist/mac-arm64/electros.app/Contents/Resources/app.nw
cp -r Info.plist dist/mac-arm64/electros.app/Contents/Info.plist
cp -r electros.iconset/icon.icns dist/mac-arm64/electros.app/Contents/Resources/nw.icns
cp -r electros.iconset/icon.icns dist/mac-arm64/electros.app/Contents/Resources/app.icns
cp -r electros.iconset/icon.icns dist/mac-arm64/electros.app/Contents/Resources/document.icns