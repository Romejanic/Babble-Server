const MySQL = require("sync-mysql");
const fs = require("fs");

var mysqlModule = {
    connect: function(config) {
        this.connection = new MySQL(config);
        console.log(this.connection);
    },
    disconnect: function() {
        this.connection.end();
    },

    performInitialization: function(config) {
        var result = this.executeSqlFile("init_db");
        if(result) {
            console.log("Sucessfully initialized MySQL database!");
        }
    },

    executeSqlFile: function(sqlName, values) {
        var sql = fs.readFileSync(__dirname + "/sql/" + sqlName + ".sql", { encoding: "utf-8" });
        if(sql) {
            sql.split("\n").forEach((query) => {
                if(!query || query.trim().length <= 0) {
                    return;
                }
                this.connection.query(query, values);
            });
            return true;
        } else {
            console.error("Failed to load SQL file: " + sqlName + ".sql");
        }
        return false;
    }
};

module.exports = mysqlModule;