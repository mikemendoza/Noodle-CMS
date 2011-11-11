var  express = require('express'), //Requires express (npm install express)
  form = require('connect-form'), // (npm install connect-form)
  fs = require('fs'), // (npm install fs)
  basicAuth = require('express').basicAuth,
  stylus = require('stylus'),
  csrf = require('express-csrf'),
  gzippo = require('gzippo');
  Mongoose = require('mongoose'), //(npm install mongoose)
  db = Mongoose.connect('mongodb://localhost/db'), //The db would be created as your database in MongoDB
  app = express.createServer(); //createServer method of express

//Must know where to put this...
//require('./settings').boot(app);

//Couldn't connect to this on: var MemStore = require('connect/middleware/session/memory');
var MemStore = require('connect').session.MemoryStore;

//Replaced by this app.configure
app.configure(function() {
  // set views path, template engine and default layout
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');

  app.set('view options', { layout: 'layouts/default' }); //BECAUSE IT CONFLICTS WITH THE layout.jade of products
    
  app.use(express.logger());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
/*  app.use(require('stylus').middleware({ src: __dirname + '/public' }));
  app.use(app.router);*/  
  app.use(express.static(__dirname + '/static'));
  app.use(express.cookieParser());
  app.use(express.session({store: MemStore({
    reapInterval: 60000 * 10
  }), secret:'foobar'
}));
  app.use(form({ 
    keepExtensions: true,
    uploadDir: __dirname + '/static/uploads/photos/'
}));
});
  app.use(app.router);
app.configure('development', function () {
  app.use(express.errorHandler({
    dumpExceptions: true,
    showStack: true
  }));
});

app.configure('production', function () {
  app.use(express.errorHandler());
});

//app.set('views', __dirname + '/views');
//app.set('view engine', 'jade');

app.dynamicHelpers({
    base: function(){
    // return the app's mount-point
    // so that urls can adjust. For example
    // if you run this example /post/add works
    // however if you run the mounting example
    // it adjusts to /blog/post/add
    return '/' == app.route ? '' : app.route;
    },
    appName: function(req, res){
    return 'node.js express demo'
    },
  
    session: function(req, res) {
      return req.session;
    },
    
    flash: function(req, res) {
      return req.flash();
    }
  }
);

  // Some dynamic view helpers
  app.dynamicHelpers({

    request: function(req){
      return req;
    },

    hasMessages: function(req){
      if (!req.session) return false;
      return Object.keys(req.session.flash || {}).length;
    },

    // flash messages
    messages: require('express-messages'),

    // dateformat helper. Thanks to gh-/loopj/commonjs-date-formatting
    dateformat: function(req, res) {
      return require('./lib/dateformat').strftime;
    },

    // generate token using express-csrf module
    csrf: csrf.token

  });

  // Use stylus for css templating

  // completely optional, however
  // the compile function allows you to
  // define additional functions exposed to Stylus,
  // alter settings, etc

  function compile(str, path) {
    return stylus(str)
      .set('filename', path)
      .set('warn', true)
      .set('compress', true)
   // .define('url', stylus.url({ paths: [__dirname + '/public/images'], limit:1000000 }));
  };

  // add the stylus middleware, which re-compiles when
  // a stylesheet has changed, compiling FROM src,
  // TO dest. dest is optional, defaulting to src

  app.use(stylus.middleware({
      debug: true
    , src: __dirname + '/stylus'
    , dest: __dirname + '/public'
    , compile: compile
  }));

  // the middleware itself does not serve the static
  // css files, so we need to expose them with staticProvider
  // We will be defining static provider when we setup env specific settings

  // Don't use express errorHandler as we are using custom error handlers
  // app.use(express.errorHandler({ dumpExceptions: false, showStack: false }));

  // show error on screen. False for all envs except development
  // settmgs for custom error handlers
  app.set('showStackError', false);

  // configure environments

  var oneYear = 31557600000;

  app.configure('development', function(){
    app.set('showStackError', true);
    app.use(express.static(__dirname + '/public', { maxAge: oneYear }));
  });

  // gzip only in staging and production envs

  app.configure('staging', function(){
    app.use(gzippo.staticGzip(__dirname + '/public', { maxAge: oneYear }));
    //app.enable('view cache');
  });

  app.configure('production', function(){
    app.use(gzippo.staticGzip(__dirname + '/public', { maxAge: oneYear }));
    // view cache is enabled by default in production mode
  });

  // check for csrf using express-csrf module
  app.use(csrf.check());

// Error configuration



  // When no more middleware require execution, aka
  // our router is finished and did not respond, we
  // can assume that it is "not found". Instead of
  // letting Connect deal with this, we define our
  // custom middleware here to simply pass a NotFound
  // exception

  app.use(function(req, res, next){
    next(new NotFound(req.url));
  });

  // Provide our app with the notion of NotFound exceptions

  function NotFound(path){
    this.name = 'NotFound';
    if (path) {
      Error.call(this, 'Cannot find ' + path);
      this.path = path;
    } else {
      Error.call(this, 'Not Found');
    }
    Error.captureStackTrace(this, arguments.callee);
  }

  /**
   * Inherit from `Error.prototype`.
   */

  NotFound.prototype.__proto__ = Error.prototype;

  // We can call app.error() several times as shown below.
  // Here we check for an instanceof NotFound and show the
  // 404 page, or we pass on to the next error handler.

  // These handlers could potentially be defined within
  // configure() blocks to provide introspection when
  // in the development environment.

  app.error(function(err, req, res, next){
    if (err instanceof NotFound){
      console.log(err.stack);
      res.render('404', {
        layout: 'layouts/default',
        status: 404,
        error: err,
        showStack: app.settings.showStackError,
        title: 'Oops! The page you requested desn\'t exist'
      });
    }
    else {
      console.log(err.stack);
      res.render('500', {
        layout: 'layouts/default',
        status: 500,
        error: err,
        showStack: app.settings.showStackError,
        title: 'Oops! Something went wrong!'
      });
    }
  });

// Include all routes here

//require('./routes/articles')(app)
var Article = require('./models/article');
// New article
  app.get('/articles/new', function(req, res){
    res.render('articles/new', {
      title: 'New Article'
    });
  });

  app.param('id', function(req, res, next, id){
    Article.findOne({ _id : req.params.id }, function(err,article) {
      if (err) return next(err);
      if (!article) return next(new Error('Failed to load article ' + id));
      req.article = article;
      next();
    });
  })

  // Create an article
  app.post('/articles', requiresLogin, function(req, res){
    article = new Article(req.body.article);
    article.save(function(err){
      req.flash('notice', 'Created successfully');
      res.redirect('/article/'+article._id);
    });
  });

  // Edit an article
  app.get('/article/:id/edit', function(req, res){
    res.render('articles/edit', {
      title: 'Edit '+req.article.title,
      article: req.article
    });
  });

  // Update article
//  app.put('/articles/:id', requiresLogin, function(req, res){ //articles/:id BUG
  app.put('/article/:id', requiresLogin, function(req, res){
    article = req.article;
    article.title = req.body.article.title;
    article.body = req.body.article.body;
    article.save(function(err) {
      req.flash('notice', 'Updated successfully');
      res.redirect('/article/'+req.body.article._id);
    });
  });

  // View an article
  app.get('/article/:id', function(req, res){
    res.render('articles/show', {
      title: req.article.title,
      article: req.article
    });
  });

  // Delete an article
  app.del('/article/:id', function(req, res){
    article = req.article;
    article.remove(function(err){
      req.flash('notice', 'Deleted successfully');
      res.redirect('/articles');
    });
  });

  // Listing of Articles
  app.get('/articles', function(req, res){
    Article
      .find({})
      .desc('created_at') // sort by date
      .run(function(err, articles) {
        res.render('articles/index', {
          title: 'List of Articles',
          articles: articles
        });
      });
  });


var port = process.env.PORT || 3000;
app.listen(port);
console.log('Express app started on port '+port);

function requiresLogin(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/sessions/new?redir=' + req.url);
  }
};

app.get('/', function(req, res) {
  res.render('root');
});

/* Sessions */

require('./users');

var User = db.model('User');

app.get('/sessions/new', function(req, res) {
  res.render('sessions/new', {locals: {
    redir: req.query.redir
  }});
});

app.post('/sessions', function(req, res) {
//  User.authenticate(req.body.login, req.body.password).first(function(user) {
  User.authenticate(req.body.login, req.body.password, function(user) {
    if (user) {
      req.session.user = user;
      res.redirect(req.body.redir || '/');
    } else {
      req.flash('warn', 'Login failed');
      res.render('sessions/new', {locals: {redir: req.body.redir}});
    }
  });
});

app.get('/sessions/destroy', function(req, res) {
  delete req.session.user;
  res.redirect('/sessions/new');
});

//require('./products');
//var Product = db.model('Product');

//var photos = require('./photos');

app.get('/products', requiresLogin, function(req, res) {
  Product.find().all(function(products) {
    res.render('products/index', {locals: {
      products: products
    }});
  });  
});

//Changed this app.get('/products/new' because localhost:4000/products/new is spewing photos & photo_list undefined and 
app.get('/products/new', requiresLogin, function(req, res) {
  photos.list(function(err, photo_list) {
    if (err) {
      throw err;
    }
    res.render('products/new', {locals: {
      photos: photo_list,
      product: req.body && req.body.product || new Product(),
    }});
  });  
});

app.post('/products', requiresLogin, function(req, res) {
  var product = new Product(req.body.product);
    product.save(function() {
      res.redirect('/products/' + product._id.toHexString());
  });
});

app.get('/products/:id', function(req, res) {
// Product.findById(req.params.id).first(function(product) { 
  Product.findById(req.params.id , function(product) {
    res.render('products/show', {locals: {
      product: product
    }});
  });
});

app.get('/products/:id/edit', requiresLogin, function(req, res) {
  Product.findById(res.redirect('/products/' + id)).first(function(product) {
    photos.list(function(err, photo_list) {
      if (err) {
        throw err;
      }
      res.render('products/edit', {locals: {
        product: product,
        photos: photo_list
      }});
    });
  });
});

app.put('/products/:id', requiresLogin, function(req, res) {
  var id = req.params.id;
  Product.findById(id).first(function(product) {
    product.name = req.body,product.name;
    product.description = req.body,product.description;
    product.price = req.body,product.price;
    product.photo = req.body,product.photo;
    product.save(function() {
      res.redirect('/products/'+ product._id.toHexString());           
    });
  });
});

/* Photos - Changed the original 013 from github*/
app.get('/photos', function(req, res) {
  photos.list(function(err, photo_list) {
    res.render('photos/index', {locals: {
      photos: photo_list
    }})
  });
});

app.get('/photos/new', function(req, res) {
  res.render('photos/new');
});

app.post('/photos', function(req, res, next){ 
req.form.complete(function(err, fields, files){   
if (err) {     
next(err);   
}
else {     
res.redirect('/photos');   
} 
});
});

//app.listen(4000);