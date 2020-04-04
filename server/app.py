import os

from flask import Flask
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from google.cloud import datastore

from web3.auto import w3
from eth_account.messages import defunct_hash_message
import re
import time

app = Flask(__name__)
limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["1440 per day", "60 per hour"]
)

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
    print(f"Updated user {address} to name {name} and email {email}. Request from ip {ipAddress}.")

if __name__ == "__main__":
    app.run(debug=True,host="0.0.0.0",port=int(os.environ.get("PORT", 8080)))
