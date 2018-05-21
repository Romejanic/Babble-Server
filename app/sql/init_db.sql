DROP DATABASE IF EXISTS babble;

CREATE DATABASE babble;
USE babble;
CREATE TABLE users (id int NOT NULL auto_increment PRIMARY KEY, name VARCHAR(100), username VARCHAR(40), password VARCHAR(1024), image MEDIUMTEXT, lastLogin bigint);
CREATE TABLE conversations (id int NOT NULL auto_increment PRIMARY KEY, name TEXT, image MEDIUMTEXT);
CREATE TABLE messages (id int NOT NULL auto_increment PRIMARY KEY, sender int NOT NULL, conversation int NOT NULL, type VARCHAR(20), content MEDIUMTEXT, timestamp bigint);
CREATE TABLE conversation_members (userId int NOT NULL, conversation int NOT NULL);