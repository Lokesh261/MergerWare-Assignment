import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
  user:"postgres",
  host:"localhost",
  password:"balls",
  database:"loans",
  port:5432
})
db.connect();

let currUser = 0;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

//Landing Page
app.get("/",async(req,res)=>{
    res.render("index.ejs");
})

app.get("/register", async(req,res)=>{
    res.render("register.ejs");
});

app.post("/registered", async(req,res)=>{
    let email = await req.body.email;
    let pword = await req.body.password;
    let role = await req.body.role;
    try{
    let query = await db.query("INSERT into users (email, password, role) values ($1, $2, $3) returning *",[email,pword,role]);
    console.log(query.rows[0]);
    res.redirect("/")
    } catch(err) {
        console.log(err);
    }
})

app.get("/log", async(req,res)=>{
    res.render("login.ejs");
})

app.get("/dash_borrow", async(req,res)=>{
    res.render("dash_borrower.ejs");
})

app.post("/login", async(req,res)=>{
    let email = await req.body.email;
    let pword = await req.body.password;
    
    try{
        let query = await db.query("Select * from users where email=$1",[email])
        let checkp = query.rows[0].password;
        if (pword != checkp){
            res.render("login.ejs",{message:"Incorrect Password!"})
        }
        else{
            currUser = query.rows[0].id;
            let role = query.rows[0].role;
            //Go to different pages according to role
            if(role == "borrower"){
                let balance = 0;
                try{
                    let funds = await db.query("Select * from loans where user_id = $1 and status = 'funded'",[query.rows[0].id]);
                    } catch(err) {
                    console.log(err);
                }
                
                res.render("dash_borrower.ejs",{id:currUser});
            }
            if(role == "lender"){
                res.render("dash_lender.ejs",{id:currUser, balance:query.rows[0].amount})
            }
            if(role == "admin"){
                res.render("dash_admin.ejs",{id:currUser})
            }

        }
    } catch(err){
        console.log(err);
    }
});

app.get("/check_balance", async(req,res)=>{
    let query = await db.query("Select * from users where id = $1",[currUser]);
    let balance = query.rows[0].amount;
    console.log(balance);
    res.render("balance.ejs",{balance:balance});
})

//Loan History
app.get("/borrowlist/:id", async(req,res)=>{
    let id = req.params.id;
    console.log(id);
    let query = await db.query("Select * from loans where user_id = $1",[id]);
    let rows = query.rows;
    res.render("borrowlist.ejs",{rows:rows});
});


app.get("/request", async(req,res)=>{
    res.render("request_loan.ejs");
});

//Loan granting endpoint
app.post("/sanction", async(req,res)=>{
    let amount = await req.body.amount;
    let rate = await req.body.rate;
    let years = await req.body.years;

    try{
        let query = await db.query("INSERT into loans (user_id, amount, rate, duration) values ($1, $2, $3, $4) returning *",[currUser, amount,rate,years]);
        console.log(query.rows[0]);
        res.render("request_loan.ejs", {message:"Loan Request accepted"});
        } catch(err) {
            console.log(err);
        }
});

app.get("/dash_lend", async(req,res)=>{
    res.render("dash_lender.ejs");
});

app.get("/add_funds", async(req,res)=>{
    res.render("add_funds.ejs");
})

//To add funds to lender's account
app.post("/money",async(req,res)=>{
    let funds = req.body.funds;
    console.log(funds);
    console.log(currUser)
    let query = await db.query("Update users set amount=amount+$1 where id=$2 returning *",[funds,currUser]);
    console.log(query.rows)
    res.render("dash_lender.ejs",{id:currUser});
})

//Show all active non-funded loans
app.get("/view_loans", async(req,res)=>{
    let query = await db.query("Select * from loans where status = $1",['pending']);
    let rows = query.rows;
    res.render("loan_list.ejs",{rows:rows});
})

//Pick a non-funded loan
app.post("/select_loan", async(req,res)=>{
    let option = req.body.select;
    console.timeLog(option);
    let query = await db.query("Select * from loans where id=$1",[req.body.select]);
    let rows = query.rows;
    let id = query.rows[0].id;
    res.render("confirm.ejs",{rows:rows,id:id});
})

//Endpoint that handles all of the calculations after the loan is granted
app.get("/confirm/:id", async(req,res)=>{
    let id = req.params.id;

    await db.query("Update loans set lender_id=$2 where id=$1 ",[id,currUser]);
    let value = await db.query("Select amount,user_id from loans where id=$1",[id])
    let newVal = value.rows[0].amount;
    let borrow_id = value.rows[0].user_id;
    await db.query("Update users set amount=amount+$1 where id=$2 ",[newVal,borrow_id]);
    await db.query("Update users set amount=amount-$1 where id=$2 ",[newVal,currUser]);
    await db.query("Update loans set status='funded' where id=$1 ",[id]);
    res.render("success.ejs",{id:currUser});
})

//authentication to be added for admin priveleges
app.get("/check_trans", async(req,res)=>{
    let query = await db.query("Select * from loans");
    let rows = query.rows
    res.render("all_trans.ejs",{rows:rows});
})


app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });

