import fs from "fs";
import axios from "axios";
import unzipper from "unzipper";
import rimraf from "rimraf";

export async function download_file(url, dest) {
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
                } else {
                    reject(error);
                }
            });
        })
    })
}

export async function unzip(src, dest) {
    return new Promise((resolve, reject) => {
        console.log("Décompréssion de:", src)
        console.log("Vers:", dest)
        fs.createReadStream(src)
            .pipe(unzipper.Parse())
            .on('entry', function (entry) {
                entry.pipe(fs.createWriteStream(dest + "/" + entry.path));

            })
            .on('finish', () => {
                resolve()
            }).on('error', () => {
            reject()
        });

    });
}

export async function rm_rf(path) {
    return new Promise((resolve, reject) => {
        rimraf(path, () => {
            resolve();
        })
    })
}