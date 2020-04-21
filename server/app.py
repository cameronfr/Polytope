from flask import Flask, make_response, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_ipaddr

# for blocks rendering
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.colors
from matplotlib.transforms import Bbox
from mpl_toolkits.mplot3d import Axes3D
import io
import base64

import os
import logging
import datetime
import google.cloud.logging
from web3.auto import w3
from eth_account.messages import defunct_hash_message
import re
import time

from google.cloud import datastore
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

corsOrigins = ["https://polytope.space", "http://localhost:1234", "http://192.168.2.167:1234"]

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

def renderBlocksObjectToSVGString(blocksObject):
    colorList = ["#ffffff","#f7b69e","#cb4d68","#c92464","#f99252","#f7e476","#a1e55a","#5bb361","#6df7c1", "#11adc1","#1e8875","#6a3771","#393457","#606c81","#644536","#9b9c82",]

    blocks = np.array(blocksObject).reshape([16, 16, 16]).transpose(0, 2, 1)[::-1, :, :] # match web
    blockColors = np.zeros(blocks.shape + (3,))
    for i in range(len(colorList)):
        color = colorList[i][1:]
        rgb = tuple(int(color[j:j+2], 16)/255 for j in (0, 2, 4))
        hsv = matplotlib.colors.rgb_to_hsv(rgb)
        hsv[2] = np.clip(hsv[2] * 1.3, 0, 1) # tweak cause kinda dark in matplotlib renderer
        rgb = matplotlib.colors.hsv_to_rgb(hsv)
        blockColors[blocks == i+1] = rgb

    plt.ioff()
    fig = plt.figure(figsize=(10,10))
    ax = fig.gca(projection='3d')
    ax.set_axis_off()
    lightsource = matplotlib.colors.LightSource(azdeg=315, altdeg=45, hsv_min_val=10, hsv_max_val=10, hsv_min_sat=10, hsv_max_sat=10)
    ax.voxels(blocks, facecolors=blockColors**1.0, shade=True, lightsource=lightsource, edgecolors=blockColors)
    # plt.show()
    buffer = io.BytesIO()
    # plt.savefig("test.png", format="png", bbox_inches=Bbox.from_bounds(1.2, 1, 8, 8))
    plt.savefig(buffer, format="svg", transparent=True, bbox_inches="tight")
    buffer.seek(0)
    svgString = buffer.getvalue().decode("utf8")
    # svgBase64 = f"data:image/svg+xml;base64,{base64.b64encode(buffer.getvalue())}"
    return svgString


# this function is going to be called externally by alot of sites
# maybe need to CORS it?
@app.route("/tokenInfo/<tokenIdString>", methods=["GET"])
def tokenInfo(tokenIdString):
    tokenId = tokenIdString.split(".json")[0]
    tokenId = tokenId.lower()
    # tokenId = '0xf30baa1b39b524ecb1fdc4db055d35923dc088fd253400a4470ac28e0d6383fa'
    # tokenId = "0x67e29c88aaf5272d51c8b73ac51620af137634fb1a6ad8670d8a5ea2e7214cdd"

    query = datastoreClient.query(kind="Item")
    query.add_filter("id", "=", tokenId)
    results = list(query.fetch()) # multiple because may be some fake-metadata items
    item = results[0]

    metadata = item["metadata"]
    metadata["external_url"] = f"https://polytope.space/item/{tokenId}"
    metadata["description"] += "\n\n\nInteract with a 3D version of this item on polytope.space"
    # TODO: store / cache these somewhere because on the fly generation expensive.
    metadata["image_data"] = renderBlocksObjectToSVGString(metadata["blocks"])
    metadata["background_color"] = "ffffff" #"221e1f"

    # TODO: use infura to only return valid metadata items
    # TODO: query.add_filter("metadataHash", "=", ..)
    # TODO: validate metadataHash on upload

    return make_response(metadata, 200)

@app.route("/getPopularItems", methods=["POST"])
def getPopularItems():
    query = datastoreClient.query(kind="ItemStats")
    query.order = ["-totalVisited"]
    query.keys_only()
    res = list(query.fetch())

    retData = [item.key.id_or_name for item in res]

    return make_response(jsonify(retData), 200)

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

        if clientStats["count"] == 1:
            # first visit
            itemStats["totalVisited"] = itemStats["totalVisited"] if "totalVisited" in itemStats else 0
            itemStats["totalVisited"] += 1

        datastoreClient.put(itemStats)
        print(itemStats)

    return make_response("placeholder", 200)

# gunicorn does not run this
if __name__ == "__main__":
    app.run(debug=True,host="0.0.0.0",port=int(os.environ.get("PORT", 8080)))
