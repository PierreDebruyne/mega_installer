const axios = require('axios')
const fs = require("fs");
const {Blob} = require('node:buffer');


const tar = require('tar');

const env = {
    main_path: process.env.MAIN_LOCATION || "C:\\Users\\Pierre\\Desktop\\bateau_test\\",
    url: process.env.URL || "http://localhost:25565",
    installer_name: process.env.INSTALLER_NAME || "resource_manager-win",
    installer_version: process.env.INSTALLER_VERSION || "latest",
}

axios.defaults.baseURL = env.url

const installers_url = "/resources/hosts/localhost/types/installers/resources/"
const storage_dir = env.main_path + "storage\\install_manager\\"
if (!fs.existsSync(storage_dir)){
    fs.mkdirSync(storage_dir);
}

async function get_installer(installer_name, version) {
    var url = installers_url + installer_name + "/releases/" + version;
    var response = await axios.get(url)
    return response.data;
}

async function download_installer(installer_name, version) {
    var url = installers_url + installer_name + "/releases/" + version + "/download";
    var response = await axios.get(url,{responseType: "blob"})
    var blob = new Blob([response.data])
    var installer_dir = storage_dir + installer_name + "\\";
    if (!fs.existsSync(installer_dir)){
        fs.mkdirSync(installer_dir);
    }
    var zip_file = installer_dir + installer_name + ".tar"
    console.log("INSTALL ZIP")
    await fs.writeFileSync(zip_file, await blob.text())
    //await response.data.pipe(await fs.createWriteStream(zip_file))
    console.log("UNZIP", zip_file)
    console.log("TO   ", installer_dir)

    if (fs.existsSync(zip_file)) {
        await fs.createReadStream(zip_file).pipe(
            tar.x({
                C: installer_dir
            })
        )
        console.log("UNZIP ok", zip_file)
    } else {
        console.log("UNZIP failed", zip_file)
    }

}

async function save_version(installer_name, installer) {
    var installer_dir = storage_dir + installer_name + "/";
    fs.writeFileSync(installer_dir + "version.json", JSON.stringify({version: installer.version}))
}

async function need_update(installer_name, installer) {
    var installer_dir = storage_dir + installer_name + "/";;
    var version_file = installer_dir + "version.json";
    if (fs.existsSync(installer_dir) && fs.existsSync(version_file)){
        const file = fs.readFileSync(version_file);
        let version = JSON.parse(file.toString())
        return Number.parseInt(version.version) < Number.parseInt(installer.version);

    } else {
        return true;
    }
}

async function install(installer_name) {

}

async function get_update(installer_name, version) {
    let installer = await get_installer(installer_name, version);
    if (installer) {
        if (await need_update(installer_name, installer)) {
            console.log("Update", installer_name, "to version", installer.version)

            if (fs.existsSync(storage_dir + installer_name)){
                fs.rmdirSync(storage_dir + installer_name, {recursive: true})
            }
            await download_installer(installer_name, version)
            await save_version(installer_name, installer)

        }
    }
}

get_update(env.installer_name, env.installer_version)

