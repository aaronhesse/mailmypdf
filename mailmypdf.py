import cgi
import lob
import urllib2
import os
import jinja2
import webapp2
import logging
import sys

sys.path.insert(0, 'libs')

import stripe

from google.appengine.api import users
from google.appengine.ext import blobstore

BLACK_AND_WHITE = "100"
COLOR = "101"

JINJA_ENVIRONMENT = jinja2.Environment(loader=jinja2.FileSystemLoader(os.path.dirname(__file__)), extensions=['jinja2.ext.autoescape'])

stripe.api_key = "sk_test_y86WRvti8rQiCRIyiuw8TctG"

# TODO: Need to figure out how long we wait before we delete the file from the store?
# When UploadHandler is called, the blobstore should already be storing the file.

from google.appengine.ext.webapp import blobstore_handlers
class UploadHandler(blobstore_handlers.BlobstoreUploadHandler):
    def post(self):
        upload_files = self.get_uploads('file')
        blob_info = upload_files[0]
        
        downloadURL = 'http://mailmypdf.appspot.com/file/%s/download' % blob_info.key()
        
        srcAddress = lob.Address(
            self.request.get('srcName'),
            self.request.get('srcAddress1'),
            self.request.get('srcAddress2'),
            self.request.get('srcCity'),
            self.request.get('srcState'),
            self.request.get('srcZip'),
            self.request.get('srcCountry'),
        )
        
        destAddress = lob.Address(
            self.request.get('destName'),
            self.request.get('destAddress1'),
            self.request.get('destAddress2'),
            self.request.get('destCity'),
            self.request.get('destState'),
            self.request.get('destZip'),
            self.request.get('destCountry'),
        )
        
        # Addresses are validated elsewhere (prior to this point). Specifically, the client-side javascript makes
        # 'validate' requests to this python server then it makes the lob calls and returns the outcome.
        
        obj = lob.create_object("uploadedPDF", downloadURL, BLACK_AND_WHITE)
        
        # Any arguments passed into the response.write() method, must be inside a python tuple.
        # the write() method only accepts two arguments (the implicit this pointer, and an argument)
        # in this case, the argument is a single tuple containing multiple arguments.
        
        self.response.write( (obj["id"], downloadURL) )

class LobValidateAddressRequestHandler(webapp2.RequestHandler):
    def post(self):
        address = lob.Address(
            self.request.get('Name'),
            self.request.get('Address1'),
            self.request.get('Address2'),
            self.request.get('City'),
            self.request.get('State'),
            self.request.get('Zip'),
            self.request.get('Country'),
        )
        self.response.write(lob.validateAddress(address))

class LobGetJobQuoteRequestHandler(webapp2.RequestHandler):
    def post(self):
        
        to_address = lob.Address(
            self.request.get('to_addressName'),
            self.request.get('to_addressAddr1'),
            self.request.get('to_addressAddr2'),
            self.request.get('to_addressCity'),
            self.request.get('to_addressState'),
            self.request.get('to_addressZip'),
            self.request.get('to_addressCountry'),
            )
        
        from_address = lob.Address(
            self.request.get('from_addressName'),
            self.request.get('from_addressAddr1'),
            self.request.get('from_addressAddr2'),
            self.request.get('from_addressCity'),
            self.request.get('from_addressState'),
            self.request.get('from_addressZip'),
            self.request.get('from_addressCountry'),
            )
        
        self.response.write(lob.job_quote(
           self.request.get('downloadURL'),
           to_address,
           from_address,
           self.request.get('objectid')
           ))

class LobCreateJobRequestHandler(webapp2.RequestHandler):
    def post(self):
        to_address = lob.Address(
            self.request.get('to_addressName'),
            self.request.get('to_addressAddr1'),
            self.request.get('to_addressAddr2'),
            self.request.get('to_addressCity'),
            self.request.get('to_addressState'),
            self.request.get('to_addressZip'),
            self.request.get('to_addressCountry'),
            )
        
        from_address = lob.Address(
            self.request.get('from_addressName'),
            self.request.get('from_addressAddr1'),
            self.request.get('from_addressAddr2'),
            self.request.get('from_addressCity'),
            self.request.get('from_addressState'),
            self.request.get('from_addressZip'),
            self.request.get('from_addressCountry'),
            )        
        
        job = lob.create_job(
            self.request.get('name'),
            to_address,
            from_address,
            self.request.get('object_id')
        )
        
        self.response.write( lob.validateJob( job["id"] ) )
        #self.response.write( job["id"] )

class LobCheckJobRequestHandler(webapp2.RequestHandler):
    def post(self):
        self.response.write(lob.validateJob(self.request.get('jobid')))

class StripeProcessPaymentHandler(webapp2.RequestHandler):
    def post(self):
        try:
            charge = stripe.Charge.create(
                amount=self.request.get('amount'),
                currency="usd",
                source=self.request.get('tokenid'),
                description=self.request.get('description')
            )
            #self.response.write(charge)
            self.response.write("True")
        except stripe.CardError, e:
            self.response.write("The card has been declined")
            pass

class PDFDownloadHandler(blobstore_handlers.BlobstoreDownloadHandler):
    def get(self, pdf_key):
        if not blobstore.get(pdf_key):
            self.error(404)
        else:
            self.send_blob(pdf_key, save_as="pdfFile")

class MainPage(webapp2.RequestHandler):
    def get(self):
        upload_url = blobstore.create_upload_url('/upload')
        template = JINJA_ENVIRONMENT.get_template('templates/index.html')
        self.response.write(template.render(uploadURL=upload_url))


application = webapp2.WSGIApplication([
    ('/', MainPage),
    ('/upload', UploadHandler),
    ('/file/([^/]+)/download', PDFDownloadHandler),
    ('/lob/validate', LobValidateAddressRequestHandler),
    ('/lob/validateJob', LobCheckJobRequestHandler),
    ('/lob/getJobQuote', LobGetJobQuoteRequestHandler),
    ('/lob/createJob', LobCreateJobRequestHandler),
    ('/stripe/processPayment', StripeProcessPaymentHandler)
], debug=True)
