const fs = require('fs');
const path = require('path');

async function loadCommands(client) {
    const commandsPath = path.join(__dirname, '../commands');
    const commandFolders = fs.readdirSync(commandsPath);

    for (const folder of commandFolders) {
        const commandFiles = fs.readdirSync(path.join(commandsPath, folder))
            .filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const command = require(path.join(commandsPath, folder, file));
            const commandName = file.replace('.js', '');
            
            client.commands.set(commandName, command);
            
            if (command.aliases && Array.isArray(command.aliases)) {
                command.aliases.forEach(alias => {
                    client.commands.set(alias, command);
                });
            }
        }
    }

    console.log(`✅ Loaded ${client.commands.size} commands`);
}

module.exports = { loadCommands };