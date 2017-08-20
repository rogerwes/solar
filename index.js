var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var path = require('path');
var later = require('later');

var spawn = require('child_process').spawn;
var proc;
var procs;

app.use('/', express.static(path.join(__dirname, 'stream')));


app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

var sockets = {};

io.on('connection', function (socket) {

    sockets[socket.id] = socket;
    console.log("Total clients connected : ", Object.keys(sockets).length);

    socket.on('disconnect', function () {
        delete sockets[socket.id];
        console.log('client disconnected')
        console.log("Total clients connected : ", Object.keys(sockets).length);
        // no more sockets, kill the stream
        if (Object.keys(sockets).length == 0) {
            console.log('Stopping stream')
            app.set('watchingFile', false);
            if (proc) proc.kill();
            fs.unwatchFile('./stream/image_stream.jpg');
        }
    });

    socket.on('start-stream', function () {
        startStreaming(io);
    });

});

http.listen(3000, function () {
    console.log('listening on *:3000');
});

function stopStreaming() {
    if (Object.keys(sockets).length == 0) {
        app.set('watchingFile', false);
        if (proc) proc.kill();
        fs.unwatchFile('./stream/image_stream.jpg');
    }
}

function startStreaming(io) {

    if (app.get('watchingFile')) {
        io.sockets.emit('liveStream', 'image_stream.jpg?_t=' + (Math.random() * 100000));
        io.sockets.emit('solarUpdate', 'image_solar.jpg?_t=' + (Math.random() * 100000));
        return;
    }
    //var timer = later.setInterval(takeSolarPicture, schedule);
    var timer2 = later.setInterval(takePicture, schedule);

    console.log('Watching for changes...');
    app.set('watchingFile', true);
    fs.watchFile('./stream/image_stream.jpg', function (current, previous) {
        io.sockets.emit('liveStream', 'image_stream.jpg?_t=' + (Math.random() * 100000));
        io.sockets.emit('textChage', incrementer);
    })
    fs.watchFile('./stream/image_solar_stream.jpg', function (current, previous) {
        io.sockets.emit('solarUpdate', 'image_solar_stream.jpg?_t=' + (Math.random() * 100000));
        io.sockets.emit('solarText', solarInc);
    })
}

// laters
var schedule = later.parse.text('every 10 seconds');
var incrementer = 0;
var solarInc = 0;

var regPhoto = true;
var photoDone = false;

function takePicture() {
    if (regPhoto) {
        console.log('snapping pic ' + incrementer);

        var picname = './stream/cam' + incrementer + '.jpg'
        var args = ["-w", "1280", "-h", "1024", "-o", picname];

        proc = spawn('raspistill', args);

        proc.on('close', (code) => {
            console.log(`reg close: ${code}`)
            // now move the file over to the stream image.
            fs.createReadStream(picname).pipe(fs.createWriteStream('./stream/image_stream.jpg'))
            photoDone = true;
        });

        incrementer += 1;
        regPhoto = !regPhoto;
    } else {
        takeSolarPicture();
        regPhoto = !regPhoto;
    }
}

function takeSolarPicture() {
    console.log('snapping solar picture ' + solarInc);

    var solarnm = './stream/solarcam' + solarInc + '.jpg'
    var argss = ["-w", "1280", "-h", "1024", "-ifx", "solarise", "-o", solarnm];

    procs = spawn('raspistill', argss);

    procs.on('close', (code) => {
        console.log(`solar close: ${code}`)
        fs.createReadStream(solarnm).pipe(fs.createWriteStream('./stream/image_solar_stream.jpg'));
    })

    solarInc += 1;
}