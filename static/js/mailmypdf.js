function alertError( messageString )
{
    $(".alert").removeClass("alert-info");
    $(".alert").removeClass("alert-success")
    $(".alert").addClass("alert-error");
    $("#alert-message").empty();
    $("#alert-message").html( "<strong>Error!</strong> " + messageString );
    $(".alert").show();
}

function alertInfo( messageString )
{
    $(".alert").removeClass("alert-success")
    $(".alert").removeClass("alert-error");
    $(".alert").addClass("alert-info");
    $("#alert-message").empty();
    $("#alert-message").html( messageString );
    $(".alert").show();
}

function alertSuccess( messageString )
{
    $(".alert").removeClass("alert-info");
    $(".alert").removeClass("alert-error");
    $(".alert").addClass("alert-success");
    $("#alert-message").empty();
    $("#alert-message").html( "<strong>Success!</strong> " + messageString );
    $(".alert").show();
}

$(window).on('popstate', function(){
    closeStripeModal();
});

var globalDropzone;

var dropzoneOptions = {
  
  autoProcessQueue: false,
  uploadMultiple: false,
  parallelUploads: 1,
  maxFiles: 1,
  paramName: "file",
  acceptedFiles: "application/pdf,application/x-pdf,application/x-bzpdf,application/x-gzpdf,.pdf",
    
  init: function() {
    globalDropzone = this;
    
    this.on("acceptedfile", function(file)
    {
        globalDropzone.removeAllFiles();
    });
    
    this.on("addedfile", function(file)
    {
        // todo: if the alert is of class info? or if it's telling the user to drop a file on the form
        if ($(".alert").hasClass("alert-info")) {
            $(".alert").hide();
        }
        
        $(".dropzone").css("border-style", "none");
    });
    
    
    this.on("error", function(file, message)
    {
        $(".dropzone").css("border-style", "none");
        console.log('dropzone error message: ' + message);
        alertError( message );
    });
    
    globalDropzone.on("dragover", function() {
        $(".dropzone").css("border-width", "2px");
        $(".dropzone").css("border-style", "dashed");
        $(".dropzone").css("border-color", "#ccc");
        return false;
    });
    
    globalDropzone.on("dragleave", function() {
        $(".dropzone").css("border-style", "none");
        return false;
    });

    this.on("success", function(data) {
        var url = data.xhr.response;
        
        // properly retrieve the objectID and its downloadURL from the response from the backend.
        
        var array = url.split(',');
        var objID = array[0];
        var objDownloadURL = array[1];
        
        objID = objID.substr(3, objID.length - 4);
        objDownloadURL = objDownloadURL.substr(2, objDownloadURL.length - 4);
        
        //console.log( "objectID: %s", objID );
        //console.log( "downloadURL: %s", objDownloadURL );
        
        // then write it into the class names of the spans (objectid and downloadURL)
        // think about what happens when we don't have the objID or downloadURL...
        
        if (objID && objDownloadURL)
        {
            document.getElementById("objectid").className = objID;
            document.getElementById("downloadURL").className = objDownloadURL;
            
            $(document).trigger('wroteClassData');
        }
    });
  }
}

function cancelStripe()
{
    $("#card-number").val('');
    $("#card-cvc").val('');
    $("#card-expiry-month").val('');
    $("#card-expiry-year").val('');
}

function submitMailingJobToLob( refundURL )
{
    //  Make an xhr request to the python server to create the job through the Lob API
    
    var jobCreateData = new FormData();
    jobCreateData.append('name', 'Uploaded PDF');
    jobCreateData.append('object_id', document.getElementById("objectid").className);    
    
    jobCreateData.append('to_addressName', document.getElementsByName("srcName")[0].value);
    jobCreateData.append('to_addressAddr1', document.getElementsByName("srcAddress1")[0].value);
    jobCreateData.append('to_addressAddr2', document.getElementsByName("srcAddress2")[0].value);
    jobCreateData.append('to_addressCity', document.getElementsByName("srcCity")[0].value);
    jobCreateData.append('to_addressState', document.getElementsByName("srcState")[0].value);
    jobCreateData.append('to_addressZip', document.getElementsByName("srcZip")[0].value);
    jobCreateData.append('to_addressCountry', document.getElementsByName("srcCountry")[0].value);
    
    jobCreateData.append('from_addressName', document.getElementsByName("destName")[0].value);
    jobCreateData.append('from_addressAddr1', document.getElementsByName("destAddress1")[0].value);
    jobCreateData.append('from_addressAddr2', document.getElementsByName("destAddress2")[0].value);
    jobCreateData.append('from_addressCity', document.getElementsByName("destCity")[0].value);
    jobCreateData.append('from_addressState', document.getElementsByName("destState")[0].value);
    jobCreateData.append('from_addressZip', document.getElementsByName("destZip")[0].value);
    jobCreateData.append('from_addressCountry', document.getElementsByName("destCountry")[0].value);    
    
    var jobCreateXhr = new XMLHttpRequest();
    jobCreateXhr.onload = jobCreateReqListener;
    jobCreateXhr.open('POST', 'lob/createJob');
    jobCreateXhr.send( jobCreateData );
    
    function jobCreateReqListener()
    {
        //console.log("jobCreateReqListener responseText: %s", this.responseText);
        
        if ( this.responseText == "True" )
        {
            alertSuccess( "Your PDF will be mailed shortly. Send Another?" );
            $("#downloadURL").removeClass();
            $("#objectid").removeClass();
            globalDropzone.removeAllFiles();
        }
        else
        {
            var localhostWarning;
            if (document.location.hostname == "localhost")
                localhostWarning = "<strong>localhost</strong>";
            
            alertError( "Unable to create Lob job for some reason. A refund will be automatically issued." + localhostWarning );
            
            //console.log("refundURL: %s", refundURL);
            
            // if the Lob Job fails, then we need to initiate a stripe refund.
            // we need the chargeid or even better the refunds URL
        }
    }
}

$(function()
{
    // After the class names are written into the spans, process the stripe payment.
    $(document).bind('wroteClassData',function()
    {
        processPayment();
    });
    
    $( "#dropzone" ).submit(function( event )
    {
      event.preventDefault();
      
      globalDropzone.processQueue();
      
      globalDropzone.on("complete", function(file)
      {
        // we used to processPayment here, but now we do that after the classNames for objectID and downloadURL are written into the html.
      });
    });
    
    $('#MailMyPDFButton').on('click', function(e) {
        var dropzoneFileCount = globalDropzone.getAcceptedFiles().length;
        
        if ( dropzoneFileCount > 0 )
        {
            //$('#MailMyPDFButton').addClass("disabled");
            
            clearTextFieldBorders();      
            validateAddresses();
        }
        else
            alertError("Please attach a file first by dropping a file onto the page.");
        
        e.preventDefault();
    });
    
    function clearTextFieldBorders()
    {
        clearSourceAddressError();
        clearDestinationAddressError();
    }
    
    function clearSourceAddressError()
    {
        // From fields:
        $('input[name=srcName]').css("border-style", "");
        $('input[name=srcName]').css("border-color", "");
        
        $('input[name=srcAddress1]').css("border-style", "");
        $('input[name=srcAddress1]').css("border-color", "");
        
        $('input[name=srcAddress2]').css("border-style", "");
        $('input[name=srcAddress2]').css("border-color", "");
        
        $('input[name=srcCity]').css("border-style", "");
        $('input[name=srcCity]').css("border-color", "");
        
        $('select[name=srcState]').css("border-style", "");
        $('select[name=srcState]').css("border-color", "");
        
        $('select[name=srcCountry]').css("border-style", "");
        $('select[name=srcCountry]').css("border-color", "");
        
        $('input[name=srcZip]').css("border-style", "");
        $('input[name=srcZip]').css("border-color", "");
    }
     
    function clearDestinationAddressError()
    {
        // To fields:
        $('input[name=destName]').css("border-style", "");
        $('input[name=destName]').css("border-color", "");
        
        $('input[name=destAddress1]').css("border-style", "");
        $('input[name=destAddress1]').css("border-color", "");
        
        $('input[name=destAddress2]').css("border-style", "");
        $('input[name=destAddress2]').css("border-color", "");
        
        $('input[name=destCity]').css("border-style", "");
        $('input[name=destCity]').css("border-color", "");
        
        $('select[name=destState]').css("border-style", "");
        $('select[name=destState]').css("border-color", "");
        
        $('select[name=destCountry]').css("border-style", "");
        $('select[name=destCountry]').css("border-color", "");
        
        $('input[name=destZip]').css("border-style", "");
        $('input[name=destZip]').css("border-color", "");   
    }
    
    $('.close').click(function()
    {
        $(".alert").hide();
    });
    
    function processPayment()
    {
        getJobQuote();
    }
    
    function getJobQuote()
    {
        // make job quote request to python backend and get the price for a job using the test api key
        var jobQuote = -1;
        
        var jobQuoteRequestData = new FormData();
        jobQuoteRequestData.append('objectid', document.getElementById("objectid").className);
        jobQuoteRequestData.append('downloadURL', document.getElementById("downloadURL").className);
        
        jobQuoteRequestData.append('to_addressName', document.getElementsByName("srcName")[0].value);
        jobQuoteRequestData.append('to_addressAddr1', document.getElementsByName("srcAddress1")[0].value);
        jobQuoteRequestData.append('to_addressAddr2', document.getElementsByName("srcAddress2")[0].value);
        jobQuoteRequestData.append('to_addressCity', document.getElementsByName("srcCity")[0].value);
        jobQuoteRequestData.append('to_addressState', document.getElementsByName("srcState")[0].value);
        jobQuoteRequestData.append('to_addressZip', document.getElementsByName("srcZip")[0].value);
        jobQuoteRequestData.append('to_addressCountry', document.getElementsByName("srcCountry")[0].value);
        
        jobQuoteRequestData.append('from_addressName', document.getElementsByName("destName")[0].value);
        jobQuoteRequestData.append('from_addressAddr1', document.getElementsByName("destAddress1")[0].value);
        jobQuoteRequestData.append('from_addressAddr2', document.getElementsByName("destAddress2")[0].value);
        jobQuoteRequestData.append('from_addressCity', document.getElementsByName("destCity")[0].value);
        jobQuoteRequestData.append('from_addressState', document.getElementsByName("destState")[0].value);
        jobQuoteRequestData.append('from_addressZip', document.getElementsByName("destZip")[0].value);
        jobQuoteRequestData.append('from_addressCountry', document.getElementsByName("destCountry")[0].value);
        
        function jobQuoteReqListener()
        {
            var jobQuote = this.responseText;
            
            //console.log("jobQuoteResponseUnparsed: " + jobQuote);
            //console.log("jobQuoteResponse: " + parseFloat(jobQuote));
            
            var jobPrice = parseFloat(jobQuote);
            
            //console.log("jobPrice: %s", jobPrice);
            
            if ( jobPrice > -1 )
            {
                activateStripeModal( jobPrice );
            }
            else
            {
                alertError("Unable to retrieve price for mailing job. Try again later.");
            }
        }
        
        var jobQuoteXhr = new XMLHttpRequest();
        jobQuoteXhr.onload = jobQuoteReqListener;
        jobQuoteXhr.open('POST', 'lob/getJobQuote');
        jobQuoteXhr.send( jobQuoteRequestData );
    }
    
    function activateStripeModal( jobPrice )
    {
        $(".alert").hide();
        
        // Convert the jobPrice from dollars into cents, then add 5 cents so we actually make money.
        jobPrice = (jobPrice * 100) + 5;
        
        var handler = StripeCheckout.configure({
            key: 'pk_test_qjYhk6ALhfcFYHVZBu6GIoCY', // Publishable Stripe API key.
            //key: 'pk_live_4b2UkcADEzszXLbdokQBeOPZ',
            image: 'static/adobe.png',
            name: 'MailMyPDF',
            description: 'Physically mailing a PDF file',
            amount: jobPrice,
            token: function(token)
            {
                // The checkout payment form has been submitted.
                
                function paymentReqListener()
                {
                    // The stripe payment has completed by the python backend by this point.
                    // If the checkout payment completed successfully, then create the lob job.
                    // Otherwise alert the user that we weren't able to process the Stripe payment.
                    
                    //console.log("this.responseText: %s", this.responseText);
                    
                    obj = JSON.parse(this.responseText);
                    
                    //console.log("paid: %s", obj.paid);
                    //console.log("refundURL: %s", obj.refundURL);
                    
                    if ( obj.paid == true ) {
                        
                        //console.log("stripe charge paid = true");
                        
                        submitMailingJobToLob( obj.refundURL );
                    }
                    else
                        alertError( "Unable to successfully process the Stripe payment. Try again later." );
                }
                
                //console.log("tokenid: %s", token.id );
                
                var paymentData = new FormData();
                paymentData.append('tokenid', token.id);
                paymentData.append('amount', jobPrice);
                paymentData.append('description', "Physically Mailing a PDF.");
                
                var paymentXhr = new XMLHttpRequest();
                paymentXhr.onload = paymentReqListener;
                paymentXhr.open('POST', 'stripe/processPayment');
                paymentXhr.send( paymentData );
            }
        });        
        
        handler.open();
    }
    
    function validateAddresses()
    {
        // validateSourceAddress will end up calling validateDestinationAddress()
        validateSourceAddress();
    }
    
    function setSourceAddressError()
    {
        alertError( "Originating address is not valid." );
        
        $('input[name=srcName]').css("border-style", "solid");
        $('input[name=srcName]').css("border-color", "red");
        
        $('input[name=srcAddress1]').css("border-style", "solid");
        $('input[name=srcAddress1]').css("border-color", "red");
        
        $('input[name=srcAddress2]').css("border-style", "solid");
        $('input[name=srcAddress2]').css("border-color", "red");
        
        $('input[name=srcCity]').css("border-style", "solid");
        $('input[name=srcCity]').css("border-color", "red");
        
        $('select[name=srcState]').css("border-style", "solid");
        $('select[name=srcState]').css("border-color", "red");
        
        $('select[name=srcCountry]').css("border-style", "solid");
        $('select[name=srcCountry]').css("border-color", "red");
        
        $('input[name=srcZip]').css("border-style", "solid");
        $('input[name=srcZip]').css("border-color", "red");
    }
    
    function setDestinationAddressError()
    {
        alertError( "Destination address is not valid." );
        
        $('input[name=destName]').css("border-style", "solid");
        $('input[name=destName]').css("border-color", "red");
        
        $('input[name=destAddress1]').css("border-style", "solid");
        $('input[name=destAddress1]').css("border-color", "red");
        
        $('input[name=destAddress2]').css("border-style", "solid");
        $('input[name=destAddress2]').css("border-color", "red");
        
        $('input[name=destCity]').css("border-style", "solid");
        $('input[name=destCity]').css("border-color", "red");
        
        $('select[name=destState]').css("border-style", "solid");
        $('select[name=destState]').css("border-color", "red");
        
        $('select[name=destCountry]').css("border-style", "solid");
        $('select[name=destCountry]').css("border-color", "red");
        
        $('input[name=destZip]').css("border-style", "solid");
        $('input[name=destZip]').css("border-color", "red");
    }
    
    function validateSourceAddress()
    {
        function srcReqListener()
        {
            if ( this.responseText == "False" )
            {
                setSourceAddressError();
                return;
            }
            
            validateDestinationAddress();
        }
        
        var srcAddressData = new FormData();
        srcAddressData.append('Name', document.getElementsByName("srcName")[0].value);
        srcAddressData.append('Address1', document.getElementsByName("srcAddress1")[0].value);
        srcAddressData.append('Address2', document.getElementsByName("srcAddress2")[0].value);
        srcAddressData.append('City', document.getElementsByName("srcCity")[0].value);
        srcAddressData.append('State', document.getElementsByName("srcState")[0].value);
        srcAddressData.append('Zip', document.getElementsByName("srcZip")[0].value);
        srcAddressData.append('Country', document.getElementsByName("srcCountry")[0].value);
        
        var srcXhr = new XMLHttpRequest();
        srcXhr.onload = srcReqListener;
        srcXhr.open('POST', 'lob/validate');
        srcXhr.send( srcAddressData );
    }
    
    function validateDestinationAddress()
    {
        function destReqListener()
        {
            if ( this.responseText == "False" )
            {
                setDestinationAddressError();
                return;
            }
            
            alertInfo( "<strong>Submitting PDF file...</strong>" );
            $( "#dropzone" ).submit();
            
        }
        
        var destAddressData = new FormData();
        destAddressData.append('Name', document.getElementsByName("destName")[0].value);
        destAddressData.append('Address1', document.getElementsByName("destAddress1")[0].value);
        destAddressData.append('Address2', document.getElementsByName("destAddress2")[0].value);
        destAddressData.append('City', document.getElementsByName("destCity")[0].value);
        destAddressData.append('State', document.getElementsByName("destState")[0].value);
        destAddressData.append('Zip', document.getElementsByName("destZip")[0].value);
        destAddressData.append('Country', document.getElementsByName("destCountry")[0].value);
        
        var destXhr = new XMLHttpRequest();
        destXhr.onload = destReqListener;
        destXhr.open('POST', 'lob/validate');
        destXhr.send( destAddressData );
    }
    
    $(document).ready(function()
    {
        alertInfo( "To mail a PDF, first drop a file onto the page." );
        
        /*
        document.getElementsByName("srcName")[0].value = "aaron hesse";
        document.getElementsByName("srcAddress1")[0].value = "4004 houston court";
        document.getElementsByName("srcCity")[0].value = "Concord";
        document.getElementsByName("srcState")[0].value =  "CA";
        document.getElementsByName("srcZip")[0].value = "94521";
        
        document.getElementsByName("destName")[0].value = "aaron hesse";
        document.getElementsByName("destAddress1")[0].value = "4004 houston court";
        document.getElementsByName("destCity")[0].value = "Concord";
        document.getElementsByName("destState")[0].value = "CA";
        document.getElementsByName("destZip")[0].value = "94521";
        */
    });
});