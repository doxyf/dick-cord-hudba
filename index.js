const Discord = require("discord.js");
const ytdl = require("ytdl-core");
const searchApi = require("youtube-search-api");
const vc  = require('@discordjs/voice');
const fs = require('fs');

const config = {
    prefix: "?",
    token: "token pico"
}

const client = new Discord.Client({intents: [3276799]});
client.on('debug', console.log);

const queue = {};
var nowPlaying = {};

client.on("ready", () => {
    console.log(`Bot ready kokote, napis ${config.prefix}help abys dostal prikazy :Ddddddddd`);

    if(!fs.existsSync('./cache/')) fs.mkdirSync('./cache/')
    else cleanCache();

    client.user.setActivity('nevim zkus ?help');
});

client.on("messageCreate", async (message) => {
    if(message.author.bot) return;
    if(!message.content.startsWith(config.prefix)) return;

    switch (message.content.toLowerCase().slice(config.prefix.length).split(" ")[0]) {
        case "help":
            message.channel.send("Tipyco mam prikazy **play (p), queue (q), stop (dc), skip (s), nowplaying (np)**");
            break;

        case "play":
        case "p":
            if(!message.member.voice.channel) return message.channel.send("Nejsi ve vc kktko");

            const playArgs = message.content.slice(message.content.toLowerCase().slice(config.prefix.length).split(" ")[0].length+config.prefix.length+1);
            if(!playArgs) return message.reply('?play <youtube url / nazev tracku>');
            const vidLink = await getLinkFromArgs(playArgs);

            const info = await searchApi.GetVideoDetails(vidLink.split('=').pop());

            if(!queue[message.guild.id]){
                queue[message.guild.id] = [{title: info.title, channel: info.channel, link: vidLink }];
                play(message);
            }       
            else {
                queue[message.guild.id].push({title: info.title, channel: info.channel, link: vidLink});
                message.channel.send(`Pridano do fronty: ${info.title}; <${vidLink}>`);
            }

            break;

        case "queue":
        case "q":
            if(!queue[message.guild.id] || queue[message.guild.id].length < 1) return message.channel.send("More tam neni nic ted");

            var q = "";
            queue[message.guild.id].forEach(e => { q += e.title + `; <${e.link}>\n` });
            message.channel.send(q)

            break;

        case "stop":
        case "disconnect":
        case "dc":

            if(message.guild.me.voice.channel){
                vc.getVoiceConnection(message.guild.id).disconnect();
                message.channel.send("Ok");
            }
            else message.channel.send("Nejsem ve vc ty kktko");

            delete queue[message.guild.id];
            delete nowPlaying[message.guild.id];

            break;

        case "s":
        case "skip":

            message.channel.send(`Skipuju na dalsi track...`);
            playFromQueue(message);

            break;

        case "np":
            
            if(!nowPlaying[message.guild.id]) return message.channel.send(`Na tomdle serveru ted nic nehraje brasko sry`);
            message.channel.send(`Co ted hraje: ${nowPlaying[message.guild.id].title}; ${nowPlaying[message.guild.id].link}`);

            break;
    
        default:
            break;
    }

});

async function play(message = new Discord.Message()){
    const vidLink = queue[message.guild.id][0].link;
    const player = vc.createAudioPlayer();

    const connection = vc.joinVoiceChannel({
        channelId: message.member.voice.channel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator
    });

    const sent = await message.channel.send('Stahuju track protoze ytdl live streaming je napicu...');
    const stream = ytdl(vidLink, { filter : 'audioonly' }).pipe(fs.createWriteStream(`./cache/${vidLink.split("=").pop()}.mp3`));

    stream.on('finish', () => {
        const epicStream = fs.createReadStream(`./cache/${vidLink.split("=").pop()}.mp3`);
        const resource = vc.createAudioResource(epicStream);
        connection.subscribe(player);
        player.play(resource);
        sent.edit("Ted hraju: "+ vidLink);
        nowPlaying[message.guild.id] = queue[message.guild.id][0];
        queue[message.guild.id].shift();
        client.user.setActivity(`LP: ${nowPlaying[message.guild.id].title} - ${nowPlaying[message.guild.id].channel}`);
        //player.on('finish', () => { playFromQueue(message, connection) });
        player.on('stateChange', (oldState, newState) => { if(newState.status == 'idle'){
            playFromQueue(message, connection)
            cleanCache();
        }});
    });
};

async function playFromQueue(message = new Discord.Message(), connection){
    if(!connection) connection = vc.getVoiceConnection(message.guild.id);
    if(!queue[message.guild.id]) return message.channel.send('Neni fronta jeste musis dat ?play');

    if(!queue[message.guild.id][0]){
        delete queue[message.guild.id];
        delete nowPlaying[message.guild.id];
        return vc.getVoiceConnection(message.guild.id).disconnect();
    }

    const player = vc.createAudioPlayer();

    const vidLink = queue[message.guild.id][0].link
    const sent = await message.channel.send('Stahuju track protoze ytdl live streaming je napicu...');
    const stream = ytdl(vidLink, { filter : 'audioonly' }).pipe(fs.createWriteStream(`./cache/${vidLink.split("=").pop()}.mp3`));

    stream.on('finish', () => {
        const epicStream = fs.createReadStream(`./cache/${vidLink.split("=").pop()}.mp3`);
        const resource = vc.createAudioResource(epicStream);
        connection.subscribe(player);
        player.play(resource);
        sent.edit(`Ted hraju (z fronty): ${queue[message.guild.id][0].title}; <${vidLink}>`);
        nowPlaying[message.guild.id] = queue[message.guild.id][0];
        queue[message.guild.id].shift();
        client.user.setActivity(`LP: ${nowPlaying[message.guild.id].title} - ${nowPlaying[message.guild.id].channel}`);
        player.on('stateChange', (oldState, newState) => { if(newState.status == 'idle'){
            playFromQueue(message, connection)
            cleanCache();
        }});
    });
}

async function getLinkFromArgs(args){
    if(ytdl.validateURL(args) && args.includes("=")) return args // youtube.com
    else if (ytdl.validateURL(args) && !args.includes("=")) return `https://www.youtube.com/watch?v=${args.split('/').pop()}`; // youtu.be
    else
    {
        const resp = await searchApi.GetListByKeyword(args);
        resp.items.filter(item => item.type == "video");
        return `https://www.youtube.com/watch?v=${resp.items[0].id}`;
    }
}

function cleanCache(){
    fs.readdirSync('./cache/').forEach(folder => fs.rmSync('./cache/'+folder));
}

client.login(config.token);