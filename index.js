require('dotenv').config()

const { Client, MessageEmbed, Util } = require('discord.js')
const ytdl = require('ytdl-core')
const YouTube = require('simple-youtube-api')

const { GOOGLE_API_KEY, PREFIX } = require('./config.json')

const client = new Client({ disableEveryone: true })

const youtube = new YouTube(GOOGLE_API_KEY)

const queue = new Map()

client.on('ready', () => {
    console.log("This bot is online")

    setInterval(() => {
        const statuses = [
            `away some tunes`,
            `youtube song vids`,
            `music on a dj mixer`,
            `the lates hits`,
            `more music`,
        ]

        const status = statuses[Math.floor(Math.random() * statuses.length)]
        client.user.setActivity(status, { type: "PLAYING" })
    }, 50000)
})

client.on('message', async message => {
    if (message.author.bot) return
    if (!message.content.startsWith(PREFIX)) return
    if (!message.channel.guild) return message.channel.send(new MessageEmbed()
        .setColor("GREEN")
        .setTitle('**ERROR**')
        .setDescription("You need to send the command in a server that you wanna hear music in and I'm in")
    )
    
    const args = message.content.substring(PREFIX.length).split(" ")
    const searchString = args.slice(1).join(' ')
    const url = args[1] ? args[1].replace(/<(._)>/g, '$1') : ''
    const serverQueue = queue.get(message.guild.id)

    if (message.content.startsWith(`${PREFIX}play`)) {
        const voiceChannel = message.member.voice.channel
        if (!voiceChannel) return message.channel.send(new MessageEmbed()
            .setColor("GREEN")
            .setTitle('**ERROR**')
            .setDescription("You need to be in a voice channel to use this command")
        )
        if (!args[1]) return message.channel.send(new MessageEmbed()
            .setColor("GREEN")
            .setTitle('**ERROR**')
            .setDescription("You need to specify what to play")
        )
        const permissions = voiceChannel.permissionsFor(message.client.user)
        if (!permissions.has('CONNECT')) return message.channel.send(new MessageEmbed()
        .setColor("GREEN")
        .setTitle('**ERROR**')
        .setDescription("I don\'t have the permission to connect to the voice channel")
        )
        if (!permissions.has('SPEAK')) return message.channel.send(new MessageEmbed()
        .setColor("GREEN")
        .setTitle('**ERROR**')
        .setDescription("I don\'t have the permission to speak in the voice channel")
        )

        if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
            const playlist = await youtube.getPlaylist(url)
            const videos = await playlist.getVideos()
            for (const video of Object.values(videos)) {
                const video2 = await youtube.getVideoByID(video.id)
                await handleVideo(video2, message, voiceChannel, true)
            }
            message.channel.send(new MessageEmbed()
                .setColor("ORANGE")
                .setTitle('**PLAYLIST**')
                .setDescription(`Play list **${playlist.title}** has been added to the queue`)
            )
            return undefined
        } else {
            try {
                var video = await youtube.getVideoByID(url)
            } catch {
                try {
                    var videos = await youtube.searchVideos(searchString, 10)
                    var index = 0
                    message.channel.send(new MessageEmbed()
                        .setColor("BLUE")
                        .setTitle('**SONG SELECTION**')
                        .setDescription(`
${videos.map(video2 => `**${index} -** ${video2.title}`).join('\n')}

Please select one of the songs ranging from 1-10
                        `)
                    )
                    try {
                        var responce = await message.channel.awaitMessages(msg => msg.content > 0 && msg.content < 11, {
                            max: 1,
                            time: 30000,
                            errors: ['time'],
                        })
                    } catch {
                        message.channel.send(new MessageEmbed()
                            .setColor("GREEN")
                            .setTitle('**ERROR**')
                            .setDescription("Now or invalid song was selection wa provided")
                        )
                    }
                    const videoIndex = parseInt(responce.first().content)
                    var video = await youtube.getVideoByID(videos[videoIndex = 1].id)
                } catch {
                    return message.channel.send(new MessageEmbed()
                        .setColor("GREEN")
                        .setTitle('**ERROR**')
                        .setDescription("I couldn\'t find any search resalts")
                    )
                }
            }

            return handleVideo(video, message, voiceChannel)
        }
    } else if (message.content.startsWith(`${PREFIX}stop`)) {
        if (!message.member.voice.channel) return message.channel.send(new MessageEmbed()
        .setColor("GREEN")
        .setTitle('**ERROR**')
        .setDescription("You need to be in a voice channel to use this command")
        )
        if (!serverQueue) return message.channel.send(new MessageEmbed()
            .setColor("GREEN")
            .setTitle('**ERROR**')
            .setDescription("There is nothing to stop")
        )
        serverQueue.songs = []
        serverQueue.connection.dispatcher.end()
        message.channel.send(new MessageEmbed()
            .setColor("BLUE")
            .setTitle('**STOPED**')
            .setDescription("Successfully stoped the music")
        )
        return undefined
    } else if (message.content.startsWith(`${PREFIX}skip`)) {
        if (!message.member.voice.channel) return message.channel.send(new MessageEmbed()
        .setColor("GREEN")
        .setTitle('**ERROR**')
        .setDescription("You need to be in a voice channel to use this command")
        )
        if (!serverQueue) return message.channel.send(new MessageEmbed()
            .setColor("GREEN")
            .setTitle('**ERROR**')
            .setDescription("There is nothing to skip")
        )
        serverQueue.connection.dispatcher.end()
        message.channel.send(new MessageEmbed()
            .setColor("BLUE")
            .setTitle('**SKIPED**')
            .setDescription("Successfully skiped")
        )
        return undefined
    } else if (message.content.startsWith(`${PREFIX}volume`)) {
        if(!message.member.voice.channel) return message.channel.send(new MessageEmbed()
        .setColor("GREEN")
        .setTitle('**ERROR**')
        .setDescription("You need to be in a voice channel to use this command")
        )
        if (!serverQueue) return message.channel.send(new MessageEmbed()
            .setColor("GREEN")
            .setTitle('**ERROR**')
            .setDescription("There is nothing to chance the volume of")
        )
        if (!args[1]) return message.channel.send(new MessageEmbed()
            .setColor("BLUE")
            .setTitle('**VOLUME**')
            .setDescription(`The volume is **${serverQueue.volume}**`)
        )
        if (isNaN(args[1])) return message.channel.send(new MessageEmbed()
            .setColor("GREEN")
            .setTitle('**ERROR**')
            .setDescription("That is not a valid volume")
        )
        if (args[1] > 5) return message.channel.send(new MessageEmbed()
            .setColor("GREEN")
            .setTitle('**ERROR**')
            .setDescription("That is to high")
        )
        serverQueue.volume = args[1]
        serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5)
        message.channel.send(new MessageEmbed()
            .setColor("BLUE")
            .setTitle('**VOLUME**')
            .setDescription(`The volume hase been set to ${args[1]}`)
        )
        return undefined
    } else if (message.content.startsWith(`${PREFIX}np`)) {
        if (!serverQueue) return message.channel.send(new MessageEmbed()
            .setColor("GREEN")
            .setTitle('**ERROR**')
            .setDescription("There is nothing playing")
        )
        message.channel.send(new MessageEmbed()
            .setColor("RED")
            .setTitle('**Now Playing**')
            .setDescription(`Now playing: **${serverQueue.songs[0].title}**`)
        )
        return undefined
    } else if (message.content.startsWith(`${PREFIX}queue`)) {
        if (!serverQueue) return message.channel.send(new MessageEmbed()
            .setColor("GREEN")
            .setTitle('**ERROR**')
            .setDescription("There is nothing playing")
        )
        message.channel.send(new MessageEmbed()
            .setColor("ORANGE")
            .setTitle(`__**Song Queue:**__`)
            .setDescription(`
${serverQueue.songs.map(song => `**-** ${song.title}`).join('\n')}
__**Now Playing:**__
${serverQueue.songs[0].title}
`, { split: true })
        )
        return undefined
    } else if (message.content.startsWith(`${PREFIX}pause`)) {
        if (!message.member.voice.channel) return message.channel.send(new MessageEmbed()
            .setColor("GREEN")
            .setTitle('**ERROR**')
            .setDescription("You need to be in a voice channel to use this command")
        )
        if (!serverQueue) return message.channel.send(new MessageEmbed()
            .setColor("GREEN")
            .setTitle('**ERROR**')
            .setDescription("There is nothing to pause")
        )
        if (!serverQueue.playing) return message.channel.send(new MessageEmbed()
            .setColor("GREEN")
            .setTitle('**ERROR**')
            .setDescription("The music is already paused")
        )
        serverQueue.playing = false
        serverQueue.connection.dispatcher.pause()
        message.channel.send(new MessageEmbed()
            .setColor("BLUE")
            .setTitle('**PAUSE**')
            .setDescription("The music is now paused")
        )
        return undefined
    } else if (message.content.startsWith(`${PREFIX}resume`)) {
        if (!message.member.voice.channel) return message.channel.send(new MessageEmbed()
            .setColor("GREEN")
            .setTitle('**ERROR**')
            .setDescription("You need to be in a voice channel to use this command")
        )
        if (!serverQueue) return message.channel.send(new MessageEmbed()
            .setColor("GREEN")
            .setTitle('**ERROR**')
            .setDescription("There is nothing to play")
        )
        if (serverQueue.playing) return message.channel.send(new MessageEmbed()
            .setColor("GREEN")
            .setTitle('**ERROR**')
            .setDescription("The music is already playing")
        )
        serverQueue.playing = true
        serverQueue.connection.dispatcher.resume()
        message.channel.send(new MessageEmbed()
            .setColor("BLUE")
            .setTitle('**RESUME**')
            .setDescription("The music is now playing")
        )
        return undefined
    } else if (message.content.startsWith(`${PREFIX}loop`)) {
        if (!message.member.voice.channel) return message.channel.send(new MessageEmbed()
            .setColor("GREEN")
            .setTitle('**ERROR**')
            .setDescription("You need to be in a voice channel to use this command")
        )
        if (!serverQueue) return message.channel.send(new MessageEmbed()
            .setColor("GREEN")
            .setTitle('**ERROR**')
            .setDescription("There is nothing to loop")
        )

        serverQueue.loop = !serverQueue.loop

        return message.channel.send(new MessageEmbed()
            .setColor("ORANGE")
            .setTitle('**LOOP**')
            .setDescription(`Looping is now ${serverQueue.loop ? `**Enabled**` : `**Disabled**` }`)
        )
    } else if (message.content.startsWith(`${PREFIX}help`)) {
        message.channel.send(new MessageEmbed()
            .setColor("#10e8f5")
            .setTitle('**HELP**')
            .setDescription(`
__**Commands:**__
1) \`$play\`
2) \`$stop\`
3) \`$skip\`
4) \`$volume\`
5) \`$np\` (AKA Now Playing)
6) \`$queue\`
7) \`$pause\`
8) \`$resume\`
9) \`$loop\`
10) \`$help\`
__**Requirements To Play Music:**__
1) Be in a voice channel
2) Use a valid link or search name
__**Support:**__
If needed further assistance DM \`Minecrafty999#3260\`
__**Other:**__
__Invite:__ https://discord.com/oauth2/authorize?client_id=763019228168061018&scope=bot&permissions=1878523201 \n__Support Server:__ https://discord.gg/nv7US2K
            `)
        )
    } else if (message.content === `${PREFIX}`) {
        message.channel.send(new MessageEmbed()
            .setColor("GREEN")
            .setTitle('**ERROR**')
            .setDescription(`Please specify what do usage \`${PREFIX} (what you want me to do here)\' `)
        )
    }
})

async function handleVideo(video, message, voiceChannel, playlist = false) {
    const serverQueue = queue.get(message.guild.id)

    const song = {
            id: video.id,
            title: Util.escapeMarkdown(video.title),
            url: `https://www.youtube.com/watch?v=${video.id}`
        }

        if (!serverQueue) {
            const queueConstruct = {
                textChannel: message.channel,
                voiceChannel: voiceChannel,
                connection: null,
                songs: [],
                volume: 5,
                playing: true,
                loop: false,
            }
            queue.set(message.guild.id, queueConstruct)

            queueConstruct.songs.push(song)

        try {
            var connection = await voiceChannel.join()
            queueConstruct.connection = connection
            play(message.guild, queueConstruct.songs[0])
        } catch (error) {
            console.log(error)
            queue.delete(message.guild.id)
            return message.channel.send(new MessageEmbed()
                .setColor("GREEN")
                .setTitle('**ERROR**')
                .setDescription(`There was an error executing the command Error: ${error}\nPlease send the error message to \`Minecrafty999#3260\``)
            )
        }
    } else {
        serverQueue.songs.push(song)
        if(playlist) return undefined
        else return message.channel.send(new MessageEmbed()
            .setColor("BLUE")
            .setTitle('**ADDED**')
            .setDescription(`ADDED: **${songInfo.videoDetails.title}**`)
        )
    }
    return undefined
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id)

    if (!song) {
        serverQueue.voiceChannel.leave()
        queue.delete(guild.id)
        return
    }

    const dispatcher = serverQueue.connection.play(ytdl(song.url))
        .on('finish', () => {
            if(!serverQueue.loop) serverQueue.songs.shift()
            play(guild, serverQueue.songs[0])
        })
        .on('error', error => {
            console.log(error)
        })
        dispatcher.setVolumeLogarithmic(serverQueue.volume / 5)

        serverQueue.textChannel.send(new MessageEmbed()
            .setColor("ORANGE")
            .setTitle('**START PLAYING**')
            .setDescription(`Start playing **${song.title}**`)
        )
}

client.login(process.env.token)