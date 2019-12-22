//https://insomnia.rest/
const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

const credentials = require('./auth/credentials.json');
const authentication_cache = './auth/authentication_cache.json';

//const authorization_endpoint = "https://www.wunderlist.com/oauth/authorize?";
const token_endpoint = 'https://accounts.spotify.com/api/token';

const connection_established = function(request,response)
{
	console.log(request.url);
	if(request.url === "/"){
    console.log(request.url);
    response.writeHead(200, {"Content-Type": "text/html"});
    let readStream = fs.createReadStream('./html/search-form.html'); //3.Remember to send the head before the response.????
    readStream.pipe(response);
	}
  else if(request.url.startsWith("/favicon.ico")){
    response.writeHead(404, {"Content-Type": "text/plain"});
    response.write("404 Not Found");
    response.end();
    return;
  }
  else if(request.url.startsWith("/album-art/"))
	{
		response.writeHead(200, {
			"Content-Type": "image/png"
		});

		var imagePath = path.join(__dirname, request.url);
		var fileStream = fs.createReadStream(imagePath);
		response.writeHead(200, {
			"Content-Type": "image/png"
		});
		fileStream.pipe(response);
		response.on('error', function(err) {
			console.log(err);
			response.writeHead(404);
			return response.end();
		});
	}

	else if(request.url.startsWith("/search"))
	{

		//How can I get the parameters from the query string?
    //http://127.0.0.1:8000/status?name=ryan
		user_input = url.parse(request.url,true).query.q;
    const post_data = querystring.stringify({
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      grant_type: credentials.grant_type
    });
    const options = {
      method:'POST',
      headers:{
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': post_data.length
      }
		};

    let cache_valid = false;
    if(fs.existsSync(authentication_cache)) //return true if the path exists
    {
      cached_auth = require(authentication_cache);
      if( Date.parse(cached_auth.expiration)>Date.parse(Date())){
        cache_valid = true;
      }
      else{
        console.log('Token Expired');
      }
    }
    if(cache_valid){
      create_search_req(cached_auth,user_input,response);
    }
    else
    {

  		let authentication_req = https.request(token_endpoint, options, function(authentication_res){
        const auth_sent_time = new Date();
        auth_sent_time.setHours(auth_sent_time.getHours()+1);
  			received_authentication(authentication_res, user_input, auth_sent_time, response);

  		});
  		authentication_req.on('error', function(e){ console.error(e); });
  		//authentication_req.write(post_data);
  		console.log("Requesting  Token");
  		authentication_req.end(post_data); //The request is not sent until req.end() is called
    }
	}
}

function create_search_req(spotify_auth, user_input, res)
  {
		const options_get = {
      method: 'GET',
      headers:
      {
        Authorization: `Bearer ${spotify_auth.access_token}`
        //json: true
      }
 }
    const search_endpoint = `https://api.spotify.com/v1/search?q=${user_input}&type=album`;
    //const input_url = search_endpoint +'?q=' +user_input + '&type=album&access_token=' + spotify_auth.access_token;
    //console.log(input_url);
    let search_req = https.request(search_endpoint, options_get, (search_res) => {
      // console.log(res);
      var body = "";
      search_res.on('data', function(chunk) {
        body += chunk;
      });

      search_res.on('end', function() {
       var  album_data = JSON.parse(body);
       const album_items = album_data.albums.items;
       var imgPath_arrs=[];
        if(fs.existsSync(`./album-art/${user_input}`)){
              for(let i = 0; i < items.length; i++){
                  const image_path = `/album-art/${user_input}/images${i}.png`;
                  imgPath_arrs.push(image_path);
              }
              generate_webpage(imgPath_arrs, res);
          }
          else{
              downloadImages(album_items, user_input, res);
          }
      });
    });

    search_req.on('error', (e) => {
        console.log("Searched album fail", e);
    });
    search_req.end();

  };


function downloadImages(items, user_input, res)
{
    let downloaded_images =0;
    let content = "";
    let imgPath_arr = [];
    items.forEach(function(item,index){
      const image_url = item.images[0].url;
      https.get(image_url,function(image_res){
        const img_path = `./album-art/images-${index}.png`;
        const new_img = fs.createWriteStream(img_path, {'encoding':null});
        image_res.pipe(new_img);
        new_img.on("finish", function(){
          imgPath_arr.push(img_path);
          downloaded_images++;
          if(downloaded_images===items.length){
            generate_webpage(imgPath_arr, res)
          }
        }).on('error',function(err){
          console.log(err);
        });
      });
    });
}

function received_authentication(authentication_res, user_input, auth_sent_time, response){
	authentication_res.setEncoding("utf8");
	let body = "";
	authentication_res.on("data", function(chunk) {body += chunk;});
	authentication_res.on("end", function(){
		const spotify_auth = JSON.parse(body);
    //console.log(spotify_auth);
    create_access_token_cache(spotify_auth,auth_sent_time);
    create_search_req(spotify_auth, user_input, response);

	});
};

function create_access_token_cache(spotify_auth,auth_sent_time){
  spotify_auth.expiration = auth_sent_time;
  const data = JSON.stringify(spotify_auth)
  const output_dir = authentication_cache;
    fs.writeFile(`${output_dir}`, data,"utf-8", function(err){
      if(err){
        throw err;
      }
      console.log("Token has been cached!!");
			console.log(spotify_auth);
    });
};

/*function create_search_req(cached_auth,user_input,response)
{
  const search_endpoint = `https://api.spotify.com/v1/search?q=${user_input}&type=album`;
  const options_get = {
    method: 'GET'
    // headers: {
    //   'Accept' : 'application/json',
    //   'Accept' : 'utf-8',
    //   'Authorization': `Bearer ${cached_auth}`
    // }
  }
  //console.log(search_endpoint);
  const request = https.request(search_endpoint, options_get, function(response){
    console.log("enter");
    let body = "";
    response.on('data', function(chunk){
      body += chunk;
    });
    response.on("end", function(){
  		const albums_result = JSON.parse(body);
      const album_items = albums_result.albums.items;
      console.log(albums_result);
      create_search_req(spotify_auth, user_input, response);
  		//get_lists(spotify_auth,response);
      if(fs.existsSync(`./album-art/${user_input}`))
      {
        let content = '';
        for(let i=0; i<items.length;i++){
          const imagePath = `/album-art/${user_input}/images${i}.png`;
          content += `<img class="logo" src="${root_path}${imagePath}" alt="album_Image">`;
        }
        generate_webpage(content, response);
      }
      else{
        downloadImages(album_items,user_input,response);
      }
  	});
  })
  response.on('err',function(e){
    console.log("Album Searching Failed.", e);
  })
   response.end();
} */

/*function generate_webpage(content, response)
{
  response.writeHead(200, {"Content-Type": "text/html"});
  response.end(content);
} */

function generate_webpage(imgPath, res)
{
  let data = "<h1>Search Results</h1>";
  for (let i = 0; i < imgPath.length; i++) {

    data += "<img src = " + '"' + imgPath[i] + '"' + "width=20% height=150 / > ";

  }
  console.log(res);
  res.writeHead(200, {
    "Content-Type": "text/html"
  });
  res.end(data);
};

/*function  downloadImages(album_items,user_input,response)
{
  let downloaded_imgages = 0;
  let content = "";
  for(var i=0; i<album_items.length; i++)
  {
    const image_url = album_items.images[0].url;
    let image_req = https.get(image_url, function(image_res){
      const dir = `./album-art/${user_input}`;
      fs.mkdirSync(dir);
      const img_path = `./album-art/${user_input}/images${i}.png`;
      let new_img = fs.createReadStream(img_path, {'encoding':null});
      image_res.pipe(new_img);
      new_img.on("finish", function(){
        downloaded_imgages++;
        const imagePath = `/album-art/${user_input}/images${i}.png`;
        content += `<img class="logo" src="${root_path}${imagePath}" alt="album_Image">`;
        if(downloadImages===album_items.length){
          generate_webpage(content, response);
        }
      });
      image_req.on('error', function(err){
        console.log(err);
      });
    });

  }

} */
  /*fs.writeFile(`${output_dir}0${index}-file-output.txt`,data, "utf-8",function(err){
    if(err){
      console.log(err);
    } */


const server = http.createServer(connection_established);
server.listen(3000);
console.log("The server is now listening on port 3000");
