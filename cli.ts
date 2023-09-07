#!/usr/bin/env ts-node
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

const envCommands = require("./commands/env");
const adminCommands = require("./commands/admin");
const userCommands = require("./commands/user");
const mockCommands = require("./commands/mock");
const viewCommands = require("./commands/view");

yargs(hideBin(process.argv))
  .command("env <command>", "environment related commands", envCommands)
  .command("admin <command>", "admin only commands", adminCommands)
  .command("user <command>", "helpful user commands", userCommands)
  .command(
    "mock <command>",
    "commands for manipulating mock assets",
    mockCommands
  )
  .command("view <command>", "commands for viewing data", viewCommands)
  .demandCommand()
  .help().argv;
