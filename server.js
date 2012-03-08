var express      = require('express'),
    socket       = require('socket.io'),
    Rdio         = require('rdio-node').Rdio,
    app          = express.createServer(express.logger()),
    io           = socket.listen(app),
    port         = process.env.PORT || 3000,
//    token        = process.env.TOKEN,
//    domain       = process.env.DOMAIN,
    token        = 'GAlPV7Sk_____3licmtoanJ5czNncnFjbnQ4dHVydHI1OGxvY2FsaG9zdELgyTPmDCCEwW-cpHjJq9E=',
    domain       = 'localhost',
    consumerKey  = process.env.CONSUMER_KEY || 'ybrkhjrys3grqcnt8turtr58',
    consumerSecret = process.env.CONSUMER_SECRET || '2GrTAwWTbQ',
    clients      = {},
    host         = null,
    numListeners = 0;

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'hbs');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function() {
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function() {
  app.use(express.errorHandler()); 
});

app.get('/', function(req, res) {
  res.render('index', { layout: false, title: 'unrecorded.fm' });
});

app.get('/client.js', function(req, res) {
  res.render('client', { layout: false, token: token, domain: domain });
});

var albumStuff = {
	getTrackList: function(albumId, socket) {
		var trackList;
		
		if (albumId != null) {
			trackList = new Array();
			
			// Create a new instance
			var r = new Rdio({
			  consumerKey: consumerKey, 
			  consumerSecret: consumerSecret
			});
			
			r.makeRequest('get', {keys: albumId}, function() {
				var trackKeys = arguments[1].result[albumId].trackKeys;
				trackKeys = trackKeys + '';
				
				r.makeRequest('get', {keys: trackKeys}, function() {
					var trackIds = arguments[1].result;

					for (track in trackIds) {
						trackList.push(trackIds[track].name);
					}

					socket.broadcast.emit('trackList', trackList);
				});
			});
		}
	}
}

var clientManagement = {
  promoteHost: function(socket) { 
    host = socket;
    console.log('unrecorded: host promoted; id=' + socket.id);

    socket.broadcast.emit('hostPromoted', { id: socket.id });
    console.log('unrecorded: sent hostPromoted id=' + socket.id);

    socket.emit('hosting');
  },
  demoteHost: function(socket) { 
    host = null; 
    console.log('unrecorded: host demoted');

    socket.broadcast.emit('hostDemoted');
    console.log('unrecorded: sent hostDemoted');
  },
  broadcastListenerCount: function(socket) { 
    socket.broadcast.emit('listeners', { listeners: numListeners });
    console.log('unrecorded: sent listeners');
  },
  disconnectClient: function(socket) { 
    clients[socket.id] = null;
    console.log('unrecorded: received disconnect; id=' + socket.id);

    socket.broadcast.emit('clientDisconnected', { id: socket.id });
    console.log('unrecorded: sent clientDisconnected id=' + socket.id);

    numListeners = numListeners - 1;
    clientManagement.broadcastListenerCount(socket);
  },
  connectClient: function(socket) { 
    clients[socket.id] = socket;
    console.log('unrecorded: received connect; id=' + socket.id);

    socket.broadcast.emit('clientConnected', { id: socket.id });
    console.log('unrecorded: sent clientConnected id=' + socket.id);

    numListeners = numListeners + 1;
    clientManagement.broadcastListenerCount(socket);
  }
}

io.sockets.on('connection', function(socket) { 
  clientManagement.connectClient(socket);

  if(host == null) { 
    clientManagement.promoteHost(socket);
  }

  socket.broadcast.emit('playing?');
  console.log('unrecorded: sent playing?');

  socket.on('next?', function() { 
    if(host == null) {
      clientManagement.promoteHost(socket);
    }

    host.emit('next');
  });

  socket.on('playing', function(data) { 
    console.log('unrecorded: received playing; id=' + socket.id);

    if(host == null) {
      clientManagement.promoteHost(socket);
    }

    if(host == socket) {
      socket.broadcast.emit('playing', { 
        playingSource: data.playingSource, 
        playingTrack: data.playingTrack,
        sourcePosition: data.sourcePosition
      });

      console.log('unrecorded: sent playing originating from host; id=' + socket.id);
      
      // get the track list and send it over
      albumStuff.getTrackList(data.playingSource, socket);
    }
  });

  socket.on('disconnect', function() { 
    clientManagement.disconnectClient(socket);

    if(host == socket) { 
      clientManagement.demoteHost(socket);
    }
  });
});

app.listen(port, function() { 
  console.log("Server listening on %d in %s mode", port, app.settings.env);
});
