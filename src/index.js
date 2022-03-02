const axios = require('axios')
const fs = require("fs");
const rimraf = require("rimraf");
let unzipper = require("unzipper")
var spawn = require('child_process').spawn;


class SolutionManager {

    constructor() {
        this.config = this.read_config();
        this.init();
    }


    read_config() {
        const file = fs.readFileSync("config.json");
        let config = JSON.parse(file.toString());
        return config;
    }

    init() {

        this.main_path = this.config.MAIN_PATH || '.';
        if (!fs.existsSync(this.main_path)) {
            fs.mkdirSync(this.main_path, {recursive: true});
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

    async install() {
        await this.setup('localhost', 'apps', 'mongodb-linux', 'latest');
        await this.setup('localhost', 'apps', 'resource_manager-linux', 'latest');
        await this.setup('localhost', 'apps', 'solution_manager-linux', 'latest');
    }

    async setup(host_name, type_name, resource_name, release_name) {
        let resource = await this.get_resource_infos(host_name, type_name, resource_name, release_name)
        await this.download_resource(host_name, type_name, resource_name, resource.version)
        await this.install_app(host_name, type_name, resource_name, resource.version)


    }

    async download_file(url, dest) {
        console.log("Download file:", url)
        const writer = fs.createWriteStream(dest);
        return axios.get(url, {responseType: 'stream'}).then(response => {
            return new Promise((resolve, reject) => {
                response.data.pipe(writer);
                let error = null;
                writer.on('error', err => {
                    error = err;
                    writer.close();
                    reject(err);
                });
                writer.on('close', () => {
                    if (!error) {
                        console.log("Téléchargement terminé")
                        resolve(true);
                    }
                });
            })
        })
    }

    async unzip(src, dest) {
        return new Promise((resolve, reject) => {
            console.log("Décompréssion de:", src)
            console.log("Vers:", dest)
            fs.createReadStream(src)
                .pipe(unzipper.Parse())
                .on('entry', function (entry) {
                    entry.pipe(fs.createWriteStream(dest + "/" + entry.path));

                })
                .on('finish', () => {resolve()}).on('error', () => {reject()});

        });

    }

    async run_mongo_db() {
        const mongodb_app_path = this.main_path + "/apps/mongodb_latest"
        const mongodb_storage_path = this.main_path + "/storage/mongodb";
        console.log(mongodb_app_path)
        let mongo_process = spawn("./run.sh", {
            cwd: mongodb_app_path,
            env: {
                PORT: 27018,
                STORAGE_PATH: mongodb_storage_path
            }
        });
        mongo_process.stdout.on('data', function (data) {
            console.log('stdout: ' + data.toString());
        });

        mongo_process.stderr.on('data', function (data) {
            console.log('stderr: ' + data.toString());
        });

        mongo_process.on('exit', function (code) {
            console.log('child process exited with code ' + code.toString());
        });
        await new Promise(r => setTimeout(r, 20000));
        mongo_process.kill()
    }

    async run_resource_manager() {
        const resource_manager_app_path = this.main_path + "/apps/resource_manager_latest"
        const resource_manager_storage_path = this.main_path + "/storage/resource_manager";
        console.log(resource_manager_app_path)
        let resource_manager_process = spawn("./run.sh", {
            cwd: resource_manager_app_path,
            env: {
                PORT: 25566,
                MONGO_URL: "mongodb://localhost:27018/official",
                RESOURCES_PATH: resource_manager_storage_path
            }
        });
        resource_manager_process.stdout.on('data', function (data) {
            console.log('stdout: ' + data.toString());
        });

        resource_manager_process.stderr.on('data', function (data) {
            console.log('stderr: ' + data.toString());
        });

        resource_manager_process.on('exit', function (code) {
            console.log('child process exited with code ' + code.toString());
        });
        await new Promise(r => setTimeout(r, 20000));
        resource_manager_process.kill()
    }

    async get_resource_infos(host_name, type_name, resource_name, release_name) {
        const url = this.config.OFFICIAL_URL || "http://localhost:25565";

        const resource_manager_url = url + "/resources/hosts/" + host_name + "/types/" + type_name + "/resources/" + resource_name + "/releases/" + release_name
        var {data: resource_manager} = await axios.get(resource_manager_url)
        return resource_manager;
    }

    async download_resource(host_name, type_name, resource_name, release_name) {
        const url = this.config.OFFICIAL_URL || "http://localhost:25565";

        const resource_manager_url = url + "/resources/hosts/" + host_name + "/types/" + type_name + "/resources/" + resource_name + "/releases/" + release_name
        const resource_manager_path = this.storage_dir + "/resource_manager/" + host_name + "/" + type_name + "/" + resource_name

        const resource_manager_tar_path = resource_manager_path + "/" + resource_name + "_" + release_name + ".zip"
        if (!fs.existsSync(resource_manager_path)) {
            fs.mkdirSync(resource_manager_path, {recursive: true});
        }
        await this.download_file(resource_manager_url + "/download", resource_manager_tar_path);

    }

    async install_app(host_name, type_name, resource_name, release_name) {
        const resource_manager_path = this.storage_dir + "/resource_manager/" + host_name + "/" + type_name + "/" + resource_name
        const resource_manager_tar_path = resource_manager_path + "/" + resource_name + "_" + release_name + ".zip"
        const resource_manager_app_path = this.main_path + "/apps/" + resource_name + "_" + release_name

        if (fs.existsSync(resource_manager_app_path)) {
            await new Promise((resolve, reject) => {
                rimraf(resource_manager_app_path, () => {
                    resolve();
                })
            })

        }
        fs.mkdirSync(resource_manager_app_path, {recursive: true});

        await this.unzip(resource_manager_tar_path, resource_manager_app_path);

        const storage_path = this.main_path + "/storage/" + resource_name;
        if (!fs.existsSync(storage_path)) {
            fs.mkdirSync(storage_path, {recursive: true});
        }

        console.log("INSTALLING")
        fs.chmodSync(resource_manager_app_path + "/install.sh" , 0o755);
          return new Promise((resolve, reject) => {
            let mongo_install_process = spawn("./install.sh", {
                cwd: resource_manager_app_path
            });
            mongo_install_process.stdout.on('data', function (data) {
                console.log('stdout: ' + data.toString());
            });

            mongo_install_process.stderr.on('data', function (data) {
                console.log('stderr: ' + data.toString());
            });

            mongo_install_process.on('exit', async function (code) {
                console.log(resource_name, 'install exited with code ' + code.toString());
                resolve();
            });
        });


    }
}

new SolutionManager().install()

