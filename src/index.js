const axios = require('axios')
const fs = require("fs");
const {rm_rf, unzip, download_file} = require("./tools");
var spawn = require('child_process').spawn;

const PLATFORM = "linux"

class SolutionManager {

    constructor(main_path, config) {
        this.config = config;
        this.main_path = main_path;
        if (!fs.existsSync(this.main_path)) {
            fs.mkdirSync(this.main_path);
        }
        const bin_dir = this.main_path + '/binaries';
        if (!fs.existsSync(bin_dir)) {
            fs.mkdirSync(bin_dir);
        }
        const app_dir = this.main_path + '/apps';
        if (!fs.existsSync(app_dir)) {
            fs.mkdirSync(app_dir);
        }
        this.storage_dir = this.main_path + '/storage';
        if (!fs.existsSync(this.storage_dir)) {
            fs.mkdirSync(this.storage_dir);
        }
    }

    async setup(host_name, type_name, resource_name, release_name) {
        console.log("###", host_name + "/" + type_name + "/" + resource_name + "/" + release_name, "###")
        try {
            let resource = await this.get_resource_infos(host_name, type_name, resource_name, release_name)
            await this.download_resource(host_name, type_name, resource_name, resource.version)
            await this.install_app(host_name, type_name, resource_name, resource.version)
            console.log("Installation success:", host_name + "/" + type_name + "/" + resource_name + "/" + release_name, "\n");
        } catch (e) {
            console.log(e.message)
            throw {message: "Impossible d'installer l'app: " + host_name + "/" + type_name + "/" + resource_name + "/" + release_name};
        }

    }

    async get_resource_infos(host_name, type_name, resource_name, release_name) {
        const url = this.config.OFFICIAL_URL || "http://localhost:25565";
        const resource_manager_url = url + "/resources/hosts/" + host_name + "/types/" + type_name + "/resources/" + resource_name + "/releases/" + release_name
        try {
            var {data: resource_manager} = await axios.get(resource_manager_url)
            return resource_manager;
        } catch (e) {
            console.log(e.message)
            throw {message: "La resource n'existe pas: " + host_name + "/" + type_name + "/" + resource_name + "/" + release_name};
        }

    }

    async download_resource(host_name, type_name, resource_name, release_name) {
        const url = this.config.OFFICIAL_URL || "http://localhost:25565";

        const resource_manager_url = url + "/resources/hosts/" + host_name + "/types/" + type_name + "/resources/" + resource_name + "/releases/" + release_name
        const resource_manager_path = this.storage_dir + "/resource_manager-" + PLATFORM + "/" + host_name + "/" + type_name + "/" + resource_name

        const resource_manager_tar_path = resource_manager_path + "/" + resource_name + "_" + release_name + ".zip"
        if (!fs.existsSync(resource_manager_path)) {
            fs.mkdirSync(resource_manager_path, {recursive: true});
        }
        await download_file(resource_manager_url + "/download", resource_manager_tar_path);
        return resource_manager_tar_path;

    }


    async install_app(host_name, type_name, resource_name, release_name) {
        const resource_manager_path = this.storage_dir + "/resource_manager-" + PLATFORM + "/" + host_name + "/" + type_name + "/" + resource_name
        const resource_manager_tar_path = resource_manager_path + "/" + resource_name + "_" + release_name + ".zip"
        const resource_manager_app_path = this.main_path + "/apps/" + resource_name + "_" + release_name

        if (fs.existsSync(resource_manager_app_path)) {
            await rm_rf(resource_manager_app_path);

        }
        fs.mkdirSync(resource_manager_app_path, {recursive: true});

        await unzip(resource_manager_tar_path, resource_manager_app_path);

        const storage_path = this.main_path + "/storage/" + resource_name;
        if (!fs.existsSync(storage_path)) {
            fs.mkdirSync(storage_path, {recursive: true});
        }

        process.stdout.write("Installing... 000%")
        fs.chmodSync(resource_manager_app_path + "/install.sh", 0o755);

        let latest_path = this.main_path + "/apps/" + resource_name + "_latest";
        if (fs.existsSync(latest_path)) {
            fs.unlinkSync(latest_path);
        }
        fs.symlinkSync(resource_manager_app_path, latest_path)

        return new Promise((resolve, reject) => {
            let mongo_install_process = spawn("./install.sh", {
                cwd: resource_manager_app_path
            });
            mongo_install_process.stdout.on('data', function (data) {
                console.log('stdout: ' + data.toString());
            });
            mongo_install_process.stderr.on('data', function (data) {
                /*let str = data.toString()
                let found = str.indexOf('%');
                if (found > 0) {
                    process.stdout.moveCursor(-4)
                    process.stdout.write(str.substring(found - 3, found + 1));
                }*/
            });

            mongo_install_process.on('exit', async function (code) {
                /*process.stdout.moveCursor(-4)
                process.stdout.write("100%");
                console.log()*/
                resolve();
            });
        });
    }
}

async function run() {
    function read_config() {
        const file = fs.readFileSync("config.json");
        let config = JSON.parse(file.toString());
        return config;
    }

    let main_path = process.argv[2] || process.cwd()

    let solution_manager = new SolutionManager(main_path, {"OFFICIAL_URL": "http://localhost:25565"})

    await solution_manager.setup('localhost', 'apps', 'mongodb-linux', 'latest');
    await solution_manager.setup('localhost', 'apps', 'resource_manager-linux', 'latest');
    await solution_manager.setup('localhost', 'apps', 'solution_manager-linux', 'latest');
    fs.symlinkSync("apps/solution_manager-linux_latest/solution_manager-linux", main_path + "/Mega")
    fs.chmodSync(main_path + "/Mega", 0o755);
    //let solution_zip_path = await solution_manager.download_resource('localhost', 'solutions', 'official_solution', "latest")

    //await unzip(solution_zip_path, main_path);

}


run()
    .then(() => {
        console.log("Success!")
    }).catch((e) => {
        throw e
    console.log(e.message)
})
