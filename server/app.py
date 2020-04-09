from flask import Flask, make_response, request
from flask_limiter import Limiter
from flask_limiter.util import get_ipaddr

import os
import logging
import datetime
import google.cloud.logging

from google.cloud import datastore

from web3.auto import w3
from eth_account.messages import defunct_hash_message
import re
import time

client = google.cloud.logging.Client()
client.setup_logging()
datastoreClient = datastore.Client()

app = Flask(__name__)
# note: if cloud run instances not maxed, in-memory storage of #hits not effective
limiter = Limiter(
    app,
    key_func=get_ipaddr,
    default_limits=["600 per minute"]
)

corsOrigins = ["https://polytope.space", "http://localhost:1234"]

@app.after_request
def addCORS(response):
    if "HTTP_ORIGIN" in request.environ and request.environ["HTTP_ORIGIN"] in corsOrigins:
        response.headers["Access-Control-Allow-Origin"] = request.environ['HTTP_ORIGIN']
        if request.method == "OPTIONS":
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS, PUT"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type"
            response.headers["Access-Control-Max-Age"] = "86400"
    return response

@app.route("/")
def hello_world():
    return "Hi, welcome."

# batch method
@app.route("/getUserData", methods=["POST"])
def getUserData():
    data = request.json

    keys = [datastoreClient.key("User", id.lower()) for id in data]
    users = datastoreClient.get_multi(keys)

    retKeys = ["name"]
    retData = {user.key.id_or_name: {key: user[key] for key in retKeys} for user in users}

    return make_response(retData, 200)

@app.route("/setFeedback", methods=["POST"])
@limiter.limit("60 per hour")
def setFeedback():
    data = request.json
    feedback = data["feedback"]
    id = data["id"] #address (note: unvalidated) if logged in

    key = datastoreClient.key("Feedback")
    entity = datastore.Entity(key=key)
    entity["feedback"] = feedback
    entity["address"] = id
    entity["date"] = datetime.datetime.utcnow()
    entity["ipAddress"] = get_ipaddr()
    datastoreClient.put(entity)

    logging.info(f"Feedback from {get_ipaddr()}: {feedback}")
    return make_response("success", 200)

@app.route("/setUserSettings", methods=["POST"])
@limiter.limit("60 per hour")
def setUserSettings():
    data = request.json
    message = data["message"]
    signature = data["signature"]
    id = data["id"].lower() #address

    # validate that message has been signed by address
    hash = defunct_hash_message(message.encode("utf-8")) # prepends / appends some stuff, then sha3-s
    messageSigner = w3.eth.account.recoverHash(hash, signature=signature).lower()
    assert (messageSigner == id)

    # parse the message
    regex = r"""^I'm updating my preferences on Polytope with the username (?P<name>.*) and the email (?P<email>.*). This request is valid until (?P<validUntil>.*)$"""
    name, email, validUntil = re.search(regex, message).groups()

    # validate that the message contents are ok to use
    assert (time.time() < int(validUntil))
    assert (len(name) < 100)
    assert (len(email) < 100)
    assert (len(name) > 0)

    with datastoreClient.transaction():
        key = datastoreClient.key("User", id)
        user = datastoreClient.get(key)
        user = user if user is not None else datastore.Entity(key=key)

        currentEmail = "" if ("email" not in user) else user["email"]
        user["email"] = currentEmail if email is "" else email
        user["name"] = name

        datastoreClient.put(user)

    ipAddress = get_ipaddr() #x-forwarded-for, from cloud run.
    logging.info(f"Updated user {id} to name {name} and email {email}. Request from ip {ipAddress}.")
    return make_response("success", 200)


@app.route("/setItemData", methods=["POST"])
def setItemData():
    data = request.json
    id = data["id"]
    metadata = data["metadata"]
    metadataHash = data["metadataHash"]

    key = datastoreClient.key("Item")
    item = datastore.Entity(key=key)
    item["id"] = id
    item["metadata"] = metadata
    item["metadataHash"] = metadataHash
    datastoreClient.put(item)

    ipAddress = get_ipaddr()
    logging.info(f"""Created item metadata with id {id} and name {metadata["name"]} and description {metadata["description"]} and metadataHash {metadataHash}. Request from ip {ipAddress}.""")
    return make_response("success", 200)

# batch method
@app.route("/getItemData", methods=["POST"])
def getItemData():
    data = request.json

    items = {}
    for id in data:
        id = id.lower()
        query = datastoreClient.query(kind="Item")
        query.add_filter("id", "=", id)
        results = list(query.fetch()) # multiple because may be some fake-metadata items
        items[id] = results

    return make_response(items, 200)

# used for setting popularity stats for now
@app.route("/getItemDetails", methods=["POST"])
def getItemDetails():
    data = request.json
    id = data["id"].lower()

    with datastoreClient.transaction():
        key = datastoreClient.key("ItemStats", id)
        itemStats = datastoreClient.get(key)
        itemStats = itemStats if itemStats is not None else datastore.Entity(key=key)
        itemStats["visitors"] = itemStats["visitors"] if "visitors" in itemStats else {}
        visitors = itemStats["visitors"]
        clientIp = get_ipaddr()
        visitors[clientIp] = visitors[clientIp] if clientIp in visitors else {"count": 0}
        clientStats = visitors[clientIp]
        clientStats["lastVisited"] = datetime.datetime.utcnow()
        clientStats["count"] += 1

        datastoreClient.put(itemStats)
        print(itemStats)

    return make_response("placeholder", 200)

# gunicorn does not run this
if __name__ == "__main__":
    app.run(debug=True,host="0.0.0.0",port=int(os.environ.get("PORT", 8080)))
