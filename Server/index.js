const express = require('express');

const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const adminRouter = express.Router();
const binRouter = express.Router();
const path = require('path');
const fs = require('fs');
const bodyparser = require('body-parser');
const db = require('./db/bins.js');

app.use(bodyparser.json());
app.use('/admin', adminRouter);
app.use('/bin', binRouter);

adminRouter.use(express.static('build/admin'));

adminRouter.get('/', (req, res) => {
  res.sendfile(path.resolve(__dirname, 'build/admin/index.html'));
});

io.of(/^\/bin\/[a-zA-Z]+/).on('connect', (socket) => {
  const namespace = socket.nsp;
  socket.join(namespace.name);

  socket.emit('codeUpdate', db.findOne(namespace.name.split('/')[2]).code);
  socket.emit('terminalUpdate', db.findOne(namespace.name.split('/')[2]).terminal);

  socket.on('updatedCode', (newCode) => {
    db.findOne(namespace.name.split('/')[2]).code = newCode;
    socket.to(namespace.name).emit('codeUpdate', newCode);
  });

  socket.on('updatedTerminal', (terminalText) => {
    db.findOne(namespace.name.split('/')[2]).terminal += terminalText;
    socket.to(namespace.name).emit('terminalUpdate', db.findOne(namespace.name.split('/')[2]).terminal);
  });
});

// will return an object containing all created bin objects
adminRouter.get('/allBins', (req, res) => {
  res.send(db.findAll());
});

// takes in an object in body containing a key name with the value of the name of the bin to be created
// and creates an object in the database with the given value
adminRouter.post('/addBin', (req, res) => {
  if (!req.body || !req.body.name) return res.status(500).json({ error: 'Must send new bin name.' });
  db.create(req.body.name);
  return res.json({ success: 'successfully created' });
});

// takes in an object in body containing a key name with the value of the name of the bin to be deleted
// deletes the db entry with the given value
adminRouter.delete('/deleteBin', (req, res) => {
  if (!req.body || !req.body.name)
    {return res.status(500).json({ error: 'Must send new bin name.' });}
  if (db.deleteOne(req.body.name)) {
    return res.json({ success: 'sucessfully deleted' });
  }
  return res.status(500).json({ error: `bin ${  req.body.name  } does not exist` });
});


binRouter.get('/:name/getContent', (req, res) => {

});

app.get('/webworker/:name', (req, res) => {
  const consoleLogOverride = 'console.log = function(string) {postMessage(string + \'\\n\');} \n try { \n';
  const catchString = '\n } catch (err) { postMessage(err); }';
  fs.writeFile(path.resolve(__dirname, '../build/webworkers/', `${req.params.name}.js`), consoleLogOverride + db.findOne(req.params.name).code + catchString, (err) => {
    if (err) throw new Error(err);
    res.sendFile(path.resolve(__dirname, '../build/webworkers/', `${req.params.name  }.js`));
  });
});

binRouter.get('/:name', (req, res, next) => {
  if (req.params.name.split('.')[req.params.name.split('.').length - 1] === 'js' || req.params.name.split('.')[req.params.name.split('.').length - 1] === 'map' || req.params.name.split('.')[req.params.name.split('.').length - 1] === 'css') {
    return next('route');
  }
  if (db.findOne(req.params.name)) {
    res.sendFile(path.resolve(__dirname, '../build/bin/index.html'));
  } else {
    res.sendStatus(404).json({ error: 'This bin does not exist!!!' });
  }
});

binRouter.use(express.static('build/bin'));

app.post('/', (req, res) => res.status(404));

app.use((req, res) => {
  res.sendStatus(404);

});

http.listen(3000, (err) => {
  if (err) throw new Error(err);
  console.log('Listening on Port 3000');
});
