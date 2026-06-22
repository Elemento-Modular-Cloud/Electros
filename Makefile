OS            := $(shell uname -s)
ARCH          := $(shell uname -m)
DAEMONS_BRANCH ?= develop
GUI_BRANCH = develop

.ONESHELL:

help:
	@echo "Electros Makefile"
	@echo "Available targets"
	@echo "daemons                 clones the daemons repository and builds the platform-appropriate variant"
	@echo "electros-electron       builds electros electron"
	@echo "atomos-gui              builds the docker container locally"
	@echo "help                    Prints help"

daemons:
	@echo "[INFO] Building Electros Daemons on branch $(DAEMONS_BRANCH)"
	git clone -b $(DAEMONS_BRANCH) git@github.com:Elemento-Modular-Cloud/elemento-monorepo-client.git tmp-daemons
	mkdir daemons
	$(MAKE) -C tmp-daemons -f ../Makefile daemons-build

daemons-build:
	python3 -m venv venv
	. ./venv/bin/activate
	python3 -m pip install -r requirements.txt
	if [ "$(OS)" = "Darwin" ]; then
		echo "[INFO] Building macOS Daemons"
		./mac.sh --local
		mv ./dist/daemon_launcher.app ../daemons/elemento_client_daemons.app
	elif [ "$(OS)" = "Linux" ]; then
		echo "[INFO] Building Linux Daemons"
		./linux.sh
	else
		echo "[ERROR] Unrecognised Platform"
		exit 1
	fi
	echo "[INFO] Successfully built Client Daemons"
	rm -rf ../tmp-daemons

electros-electron: daemons
	cd elemento-gui-new
	git pull origin ${GUI_BRANCH}
	npm i
	cd ../electros-electron
	mkdir electros-daemons
	if [ "$(OS)" = "Darwin" ]; then
		mkdir -p electros-daemons/mac/$(ARCH)
		cp -r ../daemons/elemento_client_daemons.app ./electros-daemons/mac/$(ARCH)/
	elif [ "$(OS)" = "Linux" ]; then
		mkdir -p electros-daemons/linux/$(ARCH)
		cp ../daemons/daemon_launcher ./electros-daemons/mac/$(ARCH)/elemento_daemons_linux_x86
	else
		echo "[ERROR] Unrecognised Platform"
		exit 1
	fi
	npm i
	npm run build:nosign
	echo "[INFO] Build successful! Outputs are in /electros-electron/dist"


atomos-gui:
	echo "Building Docker Container"

clean-daemons:
	rm -rf ./daemons

clean-electros-electron:
	rm -rf ./electros-electron/dist
	rm -rf ./electros-electron/electros-daemons

clean: clean-daemons clean-electros-electron
	@echo "[INFO] Cleaned"