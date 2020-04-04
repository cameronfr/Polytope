from flask import Flask, make_response, request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

import os
import logging
import google.cloud.logging

from google.cloud import datastore

from web3.auto import w3
from eth_account.messages import defunct_hash_message
import re
import time

client = google.cloud.logging.Client()
client.setup_logging()

app = Flask(__name__)
limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["1440 per day", "60 per hour"]
)

corsOrigins = ["https://polytope.space", "https://localhost:1234"]

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
    target = os.environ.get("TARGET", "World")
    return "Hello {}!\n".format(target)

@app.route("/userSettings", methods=["POST"])
def changeUserSettings():
    data = request.json
    message = data["message"]
    signature = data["signature"]
    address = data["address"]

    # validate that message has been signed by address
    hash = defunct_hash_message(message.encode("utf-8")) # prepends / appends some stuff, then sha3-s
    messageSigner = w3.eth.account.recoverHash(hash, signature=signature)
    assert (messageSigner.lower() == address.lower())

    # parse the message
    regex = r"""^I'm updating my preferences on Polytope with the username (?P<username>.*) and the email (?P<email>.*). This request is valid until (?P<validUntil>.*)$"""
    username, email, validUntil = re.search(regex, message).groups()

    # validate that the message contents are ok to use
    assert (time.time() < int(validUntil))
    assert (len(username) < 100)
    assert (len(email) < 100)
    assert (len(username) > 0)

    datastoreClient = datastore.Client()
    key = datastoreClient.key("User", address.lower())
    user = datastore.Entity(key=key)
    user["email"] = email
    user["name"] = name
    datastoreClient.put(user)

    ipAddress = flask_limiter.util.get_remote_address()
    logging.info(f"Updated user {address} to name {name} and email {email}. Request from ip {ipAddress}.")
    return make_reponse("success", 200)

# gunicorn does not run this
if __name__ == "__main__":
    app.run(debug=True,host="0.0.0.0",port=int(os.environ.get("PORT", 8080)))
