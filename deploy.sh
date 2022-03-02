#npm run build-binaries

export URL="http://localhost:25565"

export HOST="localhost"
export TYPE="installers"
export RESOURCE="mega_installer-linux"

export FILE_PATH="binaries/mega_installer-linux"

node "/home/pierre/Documents/Mega/repos/resource_uploader/src/index.js"

read -p "Press [Enter] key to exit..."