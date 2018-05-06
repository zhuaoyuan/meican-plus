let currentPage = "";
const HOST = "http://45.77.209.200";

let loadings = 0;
const MAX_LOADINGS = 1;
const SCAN_INTERVAL_MS = 100;

let dishToReload = undefined;
let ticker = 0;

if(getCookie('tempId') == undefined) {
    document.cookie = ('tempId=' + (new Date()).getTime()+Math.random() + "; max-age=86400");
}

// listen for changes
$(setInterval(function() {
    ticker++;
    $("div[class$='style-slide']").unbind().on('click', function () {
        if(loadings<MAX_LOADINGS) {
            showRaty();
        }
    });

    $("li[class$='js-scroll-item']").unbind().on('click', function () {
        if(loadings<MAX_LOADINGS) {
            showRaty();
            showOrderedRaty();
        }
    });

    if(ticker%30 == 0 && $(".raty-box")[0] == undefined){
        showOrderedRaty();
        showRaty();
    }

    if (currentPage != window.location.href) {
        currentPage = window.location.href;
        showOrderedRaty();
        showRaty();
    }

}, SCAN_INTERVAL_MS));

//for test
function outputObj(obj) {
    let description = "";
    for (let i in obj) {
        description += i + " = " + obj[i] + "\n";
    }
    console.log(description);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function showOrderedRaty() {

    let waitMs = 0;
    while($("span[class$='-style-orderDishWording']").attr("title") == undefined){
        await sleep(100);
        waitMs += 100;
        if(waitMs > 5000){
            return;
        }
    }

    let orderedDish = $("span[class$='-style-orderDishWording']").attr("title").split('(')[0];
    let dishList = [orderedDish];
    loadScore(dishList, (scoreList) => {

        scoreList = JSON.parse(scoreList);

        let scoreMap=[];
        scoreList.forEach((item) => {
            scoreMap[item.dishName] = item;
        });

        //unhandled exception
        let result = scoreMap[$("span[class$='-style-orderDishWording']").attr("title").split('(')[0]];
        removeDishToReload();
        if(result != undefined && $(".raty-box")[0] == undefined){
            let total = result.score | 0;
            let count = result.count | 0;
            let comments = JSON.parse(result.comments);
            renderRatyBox($("div[class$='-style-orderDishList']"), total, count, result.dishName, comments);
            bindSubmit();
            bindToggleComment();
        }

    });
}

async function showRaty() {

    await sleep(1000);

    let waitMs = 0;
    while($("div[class$='dishTitle']").length == 0){
        await sleep(100);
        waitMs += 100;
        if(waitMs > 5000){
            return;
        }
    }

    let dishList = [];
    $("div[class$='dishTitle']").each(function() {
        dishList.push(this.innerText);
    });

    loadScore(dishList, (scoreList) => {

        scoreList = JSON.parse(scoreList);
        let scoreMap=[];
        scoreList.forEach((item) => {
            scoreMap[item.dishName] = item;
        });

        removeDishToReload();
        $("div[class$='dishTitle']").each(function() {
            if($(this).parents("li").next().hasClass("raty-box") || scoreMap[this.innerText] == undefined){
                return;
            }
            let total = scoreMap[this.innerText].score | 0;
            let count = scoreMap[this.innerText].count | 0;
            let comments = JSON.parse(scoreMap[this.innerText].comments);
            renderRatyBox($(this).parents("li"), total, count, this.innerText, comments);
        });
        bindSubmit();
        bindToggleComment();
    });

}

function removeDishToReload(){
    if(dishToReload != undefined) {
        $("."+dishToReload).remove();
        dishToReload = undefined;
    }
}

function renderRatyBox(item, total, count, dishName, comments){

    let commentListBlock = renderCommentList(comments);

    item.after(
        "<div class='comment-box "+dishName+"' style='display: none;'>" +
            commentListBlock +
            "<textarea title='"+dishName+"'/>" +
            "<button class='submit-comment'>发表评论</button>" +
        "</div>" +
        "<div class='height-15 "+dishName+"'/>"
    ).after("" +
        "<div class='raty-box " + dishName + "'>"  +
            "<div class='score'>" + (total / (count+!count)).toFixed(1) +
                "<span class='vote-count'>" + "共" + count + "人评分" + "</span>" +
            "</div>" +
            "<button class='comment "+ dishName + "'>评论</button>" + "<button class='submit'>提交</button>" +
            "<div class='star " + dishName + "' title='" + dishName + "'></div>" +
        "</div>"
    );
    $(".star").raty();
}

function renderCommentList(comments) {
    let result = "<div class='comment-list'>";
    if(comments != undefined){
        result += comments.map((comment)=> ("<div class='comment-item'>"+comment+"</div>")).join('');
    } else{
        result += "<div class='comment-absent'>暂无评论</div>"
    }
    result += "</div>";
    return result;
}

function bindSubmit() {
    $(".submit").unbind().on('click', function() {
        let dish = this.nextElementSibling.title;
        let score = $(".star."+dish).raty("score");
        uploadScore(dish, score);
    });
    $(".submit-comment").unbind().on('click', function () {
        let dish = this.previousElementSibling.title;
        let comment = this.previousElementSibling.value;
        uploadComment(dish, comment);
    });
}

function bindToggleComment(){
    $(".comment").unbind().on('click', function () {
        let dish = this.nextElementSibling.nextElementSibling.title;
        $(".comment-box."+dish).toggle(function(){
            $(this).next(".text").animate({height: 'toggle', opacity: 'toggle'}, "slow");
        },function(){
            $(this).next(".text").animate({height: 'toggle', opacity: 'toggle'});
        });
    })
}

function uploadScore(dish, score){
    if(score == undefined) {
        $.toast('请先填写分数');
        return;
    }
    dishToReload = dish;
    let data = "?dishName=" + dish + "&score="
        + (score+"").replace(/[\ |\~|\`|\!|\@|\#|\$|\%|\^|\&|\*|||\-|\_|\+|\=|\||\\||\{|\}|\;|\:|\"|\'|\,|\<|\.|\>|\/|\?]/g,"")
        + "&id=" + getCookie('tempId');
    xhttpGet(HOST + "/upload_score" + data, (res) => {
        if(res == 'invalid params'){
            $.toast('非法参数');
        } else if(res == 'success'){
            $.toast('提交成功');
            showRaty();
            showOrderedRaty();
        } else if(res == 'multivote'){
            $.toast('一天只能给同一个菜投一票哦');
        } else {
            $.toast('未知异常');
            console.log('upload_score_fail: '+res);
        }
    });
}

function uploadComment(dish, comment){
    if(comment == undefined || comment.length == 0) {
        $.toast('请先填写评论');
        return;
    }
    dishToReload = dish;
    let data = "?dishName=" + dish + "&comment="
        + comment
        + "&id=" + getCookie('tempId');
    xhttpGet(HOST + "/upload_comment" + data, (res) => {
        if(res == 'invalid params'){
            $.toast('非法参数');
        } else if(res == 'success'){
            $.toast('提交成功');
            showRaty();
            showOrderedRaty();
        } else if(res == 'multivote'){
            $.toast('一天只能给同一个菜评论一次哦');
        } else {
            $.toast('未知异常');
            console.log('upload_comment_fail: '+res);
        }
    });
}

function loadScore(dishList, cb) {
    if(loadings < MAX_LOADINGS) {
        loadings++;
        let requestData = "?dishNames=" + dishList.join('spliter');
        xhttpGet(HOST + "/get_scores" + requestData, (res) => {
            loadings--;
            cb(res);
        })
    }
}

function xhttpGet(url, cb){
    chrome.runtime.sendMessage({
        method: 'GET',
        action: 'xhttp',
        url: url
    }, cb);
}

function getCookie(key) {
    let arr,reg=new RegExp("(^| )"+key+"=([^;]*)(;|$)");

    if(arr=document.cookie.match(reg))
        return (arr[2]);
    else
        return null;
}