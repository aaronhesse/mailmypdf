import cgi
import lob
import urllib2
import os
import jinja2
import webapp2
import logging
import sys
import json

sys.path.insert(0, 'libs')

import stripe

from google.appengine.api import users
from google.appengine.ext import blobstore

BLACK_AND_WHITE = "100"
COLOR = "101"

JINJA_ENVIRONMENT = jinja2.Environment(loader=jinja2.FileSystemLoader(os.path.dirname(__file__)), extensions=['jinja2.ext.autoescape'])

# Change this API KEY to the LIVE key when everything is said and done.

stripe.api_key = os.environ['STRIPE_API_TEST_KEY']

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
        
        outputDict = {}
        outputDict['jobid'] = job["id"]
        outputDict['validJob'] = lob.validateJob( job["id"] )
        outputDict['deliveryDate'] = job["expected_delivery_date"]
        
        outputJSON = json.dumps( outputDict )
        
        logging.info( "outputJSON: %s", outputJSON )
        
        self.response.write( outputJSON )

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
            
            # can we somehow only return true if creating the charge was successful?
            # maybe we already go to the except clause if there's an error, so therefore, if we're still
            # in this block of code, we must have succeeded? so return "True"? maybe double check stripe docs to make sure
            
            #logging.info("charge: %s", charge)
            
            outputDict = {}
            outputDict['paid'] = charge.paid
            outputDict['chargeid'] = charge.id
            
            outputJSON = json.dumps( outputDict )
            
            #logging.info("outputJSON: %s", outputJSON)
            
            self.response.write( outputJSON )
        except stripe.CardError, e:
            logging.info( e )
            self.response.write("The card has been declined")
            pass

class StripeIssueRefund(webapp2.RequestHandler):
    def post(self):
        try:
            refund = stripe.Refund.create(
                charge=self.request.get('chargeid'),
                reason="Unable to properly create the lob job to mail the PDF file."
                # amount is not specified, the default is the full amount of the original charge.
            )
            
            outputDict = {}
            outputDict['refundid'] = refund.id
            
            outputJSON = json.dumps( outputDict )
            
            self.response.write( outputJSON )
            
        except stripe.CardError, e:
            logging.info( e )
            self.response.write( "There was a problem issuing the refund for some reason. %s", e.message )
            pass


class LobSendEmailReceiptRequestHandler(webapp2.RequestHandler):
    def post(self):        
        jobid = self.request.get('jobid')
        srcEmail = self.request.get('srcEmail')
        deliveryDate = self.request.get('deliveryDate')
        
        #gmail.sendEmailReceipt( jobid, srcEmail, deliveryDate )
        #logging.info("Email Reciept Forwarded for lob job: %s, %s.", self.request.get('jobid'), self.request.get('srcEmail'))
        
        self.response.write( "Not yet Implemented. (" + jobid + ", " + srcEmail + ", " + deliveryDate + ")" );

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
    ('/lob/sendLobEmailReceipt', LobSendEmailReceiptRequestHandler),
    ('/stripe/processPayment', StripeProcessPaymentHandler),
    ('/stripe/issueRefund', StripeIssueRefund)
], debug=True)
