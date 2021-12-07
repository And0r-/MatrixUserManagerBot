const axios = require('axios');

class Matrix {
    constructor() {
    }

    async getUserList() {
        let config = {
            headers: {
                'Authorization': 'Bearer ' + process.env.MATRIX_BOT_TOKEN
            }
        }

        let url = process.env.MATRIX_HOST + '_synapse/admin/v2/users';

        return axios.get(url, config)
            .then(res => {
                return res.data;
            })
            .catch(error => {
                console.log("error..." + error)
                console.log(error.response.data);
            });
    }
}

module.exports = { Matrix }