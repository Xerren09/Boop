const express = require('express');
const router = express.Router();
const webhook = require('../../lib/webhook');

router.post('/webhook', function(req, res) {
    webhook.run(req).then((result)=>{
        res.status(result.code).json({
            status: "success",
            content: result
        });
    }).catch((result)=>{
        res.status(result.code).json({
            status: "fail",
            content: result
        });
    });
});

module.exports = {
    router
}