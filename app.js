const express = require('express');
const app = express();
const userModel = require('./models/user');
const postModel = require('./models/post');
const cookieParser = require('cookie-parser');
const PORT = 3000;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const upload = require('./config/multerconfig');
const { render } = require('ejs');

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));



// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//       cb(null, './public/images/uploads')
//     },
//     filename: function (req, file, cb) {
//       crypto.randomBytes(12, (err, bytes) => {
//         const fn = bytes.toString("hex") + path.extname(file.originalname)
//         cb(null, fn)
//       })
//     }
// })
  
// const upload = multer({ storage: storage })


// app.get('/test', (req, res) => {
//     res.render('test');
// });

// app.post('/upload', upload.single('image'), (req, res) => {
//     console.log(req.body); // All the text documents are there in req.body
//     console.log(req.file); // All the document will be there in the req.file
    
// });
// app.post('/upload', upload.single("image"), async (req, res) => {
//     let user = await userModel.findOne({email : req.body.email});
//     // console.log(req.user.email);
//     if(user) {
//         // userModel.findOneAndUpdate(profilepic, req.file.filename);
//         user.profilepic = req.file.filename;
//     } else {
//         res.render("Some thing gone wrong");
//     }
//     await user.save();
//     res.redirect("/profile");
// });




app.get('/', (req, res) => {
    res.render('index');
});

app.get('/profile/upload', (req, res) => {
    res.render('profileupload');
});

app.post("/upload", isLoggedIn, upload.single("image"), async (req, res) => {
    console.log(req.file);
    let user = await userModel.findOne({email: req.user.email});
    user.profilepic = req.file.filename;
    user.save();
    res.redirect('/profile');
    
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/profile', isLoggedIn, async (req, res) => {
    try {
        let user = await userModel.findOne({ email: req.user.email }).populate('posts');
        if (!user) {
            return res.status(404).send("User not found");
        }
        res.render('profile', { user });
    
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

app.get('/like/:id', isLoggedIn, async (req, res) => {
    let post = await postModel.findOne({ _id: req.params.id });

    if(post.likes.indexOf(req.user.userid) === -1) {
        post.likes.push(req.user.userid);
    } else {
        post.likes.splice(post.likes.indexOf(req.user.userid), 1);
    }

    
    await post.save();
    res.redirect("/profile");
});

app.get('/edit/:id', isLoggedIn, async (req, res) => {
    let post = await postModel.findOne({ _id: req.params.id }).populate("user");
    res.render('edit', {post});
});

app.post('/update/:id', isLoggedIn, async (req, res) => {
    let post = await postModel.findOneAndUpdate({ _id: req.params.id }, {content : req.body.content});
    res.redirect('/profile');
});

app.post("/post", isLoggedIn, async (req, res) => {
    let user = await userModel.findOne({email : req.user.email});
    let {content} = req.body;

    let post = await postModel.create({
        user : user._id,
        content
    });

    user.posts.push(post._id);
    await user.save();
    res.redirect("/profile");
});

app.post('/register', async (req, res) => {
    let { email, password, name, username, age } = req.body;

    try {
        let user = await userModel.findOne({ email });
        if (user) {
            return res.status(400).send("User Already Registered");
        }

        bcrypt.genSalt(10, async (err, salt) => {
            if (err) {
                return res.status(500).send("Error generating salt");
            }

            bcrypt.hash(password, salt, async (err, hash) => {
                if (err) {
                    return res.status(500).send("Error hashing password");
                }

                try {
                    let newUser = await userModel.create({
                        username,
                        name,
                        email,
                        age,
                        password: hash
                    });

                    let token = jwt.sign({ email: email, userid: newUser._id }, "iwionrf");

                    res.cookie("token", token);

                    return res.redirect('/login');
                } catch (error) {
                    return res.status(500).send("Error creating user");
                }
            });
        });
    } catch (error) {
        return res.status(500).send("Internal Server Error");
    }
});

app.post('/login', async (req, res) => {
    let {email, password} = req.body;
    let user = await userModel.findOne({email});
    if(!user) return res.status(500).send("Something Went Wromg");
    
    bcrypt.compare(password, user.password, (err, result) => {
        if(result) {
            let token = jwt.sign({email : email, userid : user._id}, "iwionrf");
            res.cookie("token", token);
            res.status(200).redirect('/profile');
        }
        else res.redirect("/login");
    })
});

app.get('/logout', (req, res) => {
    res.clearCookie("token");  // Clear the token cookie
    res.redirect('/login');
});

app.get('/delete/:id', async (req, res) => {
    await postModel.findOneAndDelete({_id: req.params.id});
    res.redirect('/profile');
});

app.get('/allposts', isLoggedIn, async (req, res) => {
    try {
        const posts = await postModel.find().populate('user'); 
        res.render('allposts', { posts, user: req.user }); 
    } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).send("Server Error");
    }
});

function isLoggedIn(req, res, next) {
    if (!req.cookies.token) {
        return res.redirect("/login");

    } else {
        try {
            let data = jwt.verify(req.cookies.token, "iwionrf");
            req.user = data;
            next();  // Proceed to the next middleware or route
        } catch (err) {
            return res.status(401).send("Invalid token, please log in again");
        }
    }
}

app.listen(PORT);
