const MySQL = require("sync-mysql");
const fs = require("fs");
const path = require("path");

var mysqlModule = {
    connect: function(config) {
        this.connection = new MySQL(config);
    },
    disconnect: function() {
        this.connection.dispose();
    },

    performInitialization: function(config) {
        var result = this.executeSqlFile("init_db");
        if(result) {
            console.log("Sucessfully initialized MySQL database!");
        }
    },

    executeSqlFile: function(sqlName, values) {
        var sql = fs.readFileSync(path.join(__dirname, "sql", sqlName + ".sql"), { encoding: "utf-8" });
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
    },

    query: function(sql, values) {
        try {
            return this.connection.query(sql, values);
        } catch(e) {
            return e;
        }
    }
};

module.exports = mysqlModule;