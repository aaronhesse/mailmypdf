import base64
import collections
import json
import urllib
import logging
import pprint

from google.appengine.api import urlfetch
from webapp2_extras.security import generate_random_string

API_KEY = "test_166c82095487bb7cd46145131e7299225f8"  # replace with live key in production

BASE_URL = "https://api.lob.com/v1/"

BLACK_AND_WHITE = "100"
COLOR = "101"

PACKAGING_AUTOMATIC = "1"
PACKAGING_ENVELOPE = "4"

Address = collections.namedtuple("Address", "name address_line1 address_line2 address_city address_state address_zip address_country")


def flatten(obj):
    """
    flatten dict in the style of jquery.params()
    """
    if not isinstance(obj, dict):
        return obj

    result = {}
    for key, value in obj.iteritems():
        if isinstance(value, dict):
            for subkey, subvalue in value.iteritems():
                result["{}[{}]".format(key, subkey)] = flatten(subvalue)
        else:
            result[key] = value
    return result


def api_call(path, payload=None, method='GET', headers=None, deadline=30, test=False):
    if headers is None:
        headers = {}

    if test:
        # hard-coded test api key used for getting quotes
        api_key = "test_6b64e2af9a4e42c66d7a9552f122d20abd6"
    else:
        api_key = API_KEY

    headers["Authorization"] = "Basic " + base64.b64encode("{}:".format(api_key))

    if payload:
        encoded_payload = urllib.urlencode(flatten(payload))
    else:
        encoded_payload = None

    logging.info("sending lob request: %s %s", path, payload)
    result = urlfetch.fetch(BASE_URL + path, payload=encoded_payload, method=method, headers=headers, deadline=deadline)
    logging.info("got lob response: %s %s", result.status_code, result.content)

    if result.status_code == 401:
        raise Exception("Error {} talking to Lob: {}".format(result.status_code, result.content))

    try:
        response = json.loads(result.content)
    except ValueError:
        response = None

    return response


def verify_address(address):
    return api_call("verify", method="POST", payload=address._asdict())


def validateAddress(address):
    response = verify_address(address)
    if "errors" in response:
        raise Exception("Invalid address")

def create_object(name, url, print_type, test=False):
    payload = {
        "name": name,
        "file": url,
        "setting": print_type
    }
    return api_call("objects", method="POST", payload=payload, test=test)


def create_job(name, to_address, from_address, object_id, test=False):
    payload = {
        "name": name,
        "to": to_address._asdict(),
        "from": from_address._asdict(),
        "object1": object_id,
        "packaging": PACKAGING_ENVELOPE,
    }
    return api_call("jobs", method="POST", payload=payload, test=test)


def job_quote(url, to_address, from_address, object_id):
    """
    Get a quote for job by creating it in test mode.  Objects do not have the
    original file information contained on them, so we require the url.

    I am told that they will not have a way to query the price for a job before
    creating it for some time, so this is the most reasonable way.

    The next most reasonable way might be to encode their pricing structure in
    code and just calculate it locally.
    """
    original_obj = get_object(object_id)
    # re-create the object in test mode
    name = "mirror:{}:{}".format(object_id, generate_random_string(8))
    test_obj = create_object(name, url, original_obj["setting"]["id"], test=True)
    # create a job for the object
    test_job = create_job(name, to_address, from_address, test_obj["id"], test=True)
    # get the price of the job
    return float(test_job["price"])


def get_object(object_id):
    return api_call("objects/" + object_id)


def get_job(job_id):
    return api_call("jobs/" + job_id)


def main():
    address = Address(
        name="Christopher Hesse",
        address_line1="19 Boardman Pl Apt 1",
        address_line2="",
        address_city="San Francisco",
        address_state="CA",
        address_zip="94103",
        address_country="US",
    )
    to_address = address
    from_address = address

    response = verify_address(address)
    if "errors" in response:
        raise Exception("Invalid address")
    print "valid address"

    url = "http://www.irs.gov/pub/irs-pdf/fw9.pdf"
    obj = create_object("object", url, BLACK_AND_WHITE)
    print "created object"
    pprint.pprint(obj)
    print "quote:", job_quote(url, to_address, from_address, obj["id"])

    job = create_job("job", to_address, from_address, obj["id"])
    print "created job"
    pprint.pprint(job)
    job = get_job(job["id"])
    print "retrieved job"
    pprint.pprint(job)

if __name__ == '__main__':
    main()

