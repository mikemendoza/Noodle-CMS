var Mongoose = require("mongoose"), Schema = Mongoose.Schema;

var User = new Schema({
login : {type: String, index:true},
password : {type: String, index:true},
role : {type: String},
});
User.static({
authenticate : function(login,password,callback){
this.findOne({login:login,password:password},function(err,doc){
callback(doc);
})
}
});
//Mongoose.model('users', User); 
Mongoose.model('User', User); 