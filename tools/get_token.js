var Rdio           = require('../rdio-simple/rdio'),
    consumerKey    = process.env.CONSUMER_KEY,
    consumerSecret = process.env.CONSUMER_SECRET;

var r = new Rdio([consumerKey, consumerSecret]);

r.call('getPlaybackToken', {domain: 'localhost'}, function() {
  console.log(arguments);
});