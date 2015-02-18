import cgi
import lob
import urllib2
import os
import jinja2
import webapp2
import logging

from google.appengine.api import users
from google.appengine.ext import blobstore

BLACK_AND_WHITE = "100"
COLOR = "101"

JINJA_ENVIRONMENT = jinja2.Environment(loader=jinja2.FileSystemLoader(os.path.dirname(__file__)), extensions=['jinja2.ext.autoescape'])

# When UploadHandler is called, the blobstore should already be storing the file.
# TODO: Need to figure out how long we wait before we delete the file from the store?
# This uploadHandler should only be called when somebody clicks and drags their PDF

from google.appengine.ext.webapp import blobstore_handlers
class UploadHandler(blobstore_handlers.BlobstoreUploadHandler):
    def post(self):
        upload_files = self.get_uploads('file')
        blob_info = upload_files[0]
    
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

        lob.validateAddress(srcAddress)
        lob.validateAddress(destAddress)
    
        downloadURL = 'http://mailmypdf.appspot.com/file/%s/download' % blob_info.key()
        #downloadURL = 'http://localhost:8080/file/%s/download' % blob_info.key() # for debug/localhost
    
        obj = lob.create_object("uploadedPDF", downloadURL, BLACK_AND_WHITE)
        logging.warn( obj )
        job = lob.create_job("job", destAddress, srcAddress, obj["id"])
    
        template_values = {
            'srcAddress': srcAddress,
            'destAddress': destAddress,
            'downloadURL': downloadURL
        }
    
        # todo: actually show some UI for getting stripe info?
        # then modal window for showing thank you!
        # then redirect user to index page? (with empty form)
    
        template = JINJA_ENVIRONMENT.get_template('templates/mailedTemplate.html')
        self.response.write(template.render(template_values))

class PDFDownloadHandler(blobstore_handlers.BlobstoreDownloadHandler):
    def get(self, pdf_key):
        if not blobstore.get(pdf_key):
            self.error(404)
        else:
            self.send_blob(pdf_key, save_as="pdfFile")

class MainPage(webapp2.RequestHandler):

    def get(self):
        upload_url = blobstore.create_upload_url('/upload')
        template = JINJA_ENVIRONMENT.get_template('templates/indexTemplate.html')
        self.response.write(template.render(uploadURL=upload_url))


application = webapp2.WSGIApplication([
    ('/', MainPage),
    ('/upload', UploadHandler),
    ('/file/([^/]+)/download', PDFDownloadHandler),
], debug=True)
