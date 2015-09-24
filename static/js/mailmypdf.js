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

$(window).on('popstate', function()
{
    closeStripeModal();
});

var globalDropzone;
var globalJobQuote = -1;

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
        
        $('#MailMyPDFButtonClickable').css("display", "none");
        $('#MailMyPDFButton').css("display", "");
    });
    
    this.on("addedfile", function(file)
    {
        if ($(".alert").hasClass("alert-info"))
        {
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
    
    globalDropzone.on("dragover", function()
                      {
        $(".dropzone").css("border-width", "2px");
        $(".dropzone").css("border-style", "dashed");
        $(".dropzone").css("border-color", "#ccc");
        return false;
    });
    
    globalDropzone.on("dragleave", function()
    {
        $(".dropzone").css("border-style", "none");
        return false;
    });

    this.on("success", function(data)
    {
        var url = data.xhr.response;
        
        // properly retrieve the objectID and its downloadURL from the response from the backend.
        
        var array = url.split(',');
        var objID = array[0];
        var objDownloadURL = array[1];
        
        objID = objID.substr(3, objID.length - 4);
        objDownloadURL = objDownloadURL.substr(2, objDownloadURL.length - 4);
        
        // console.log( "objectID: %s", objID );
        // console.log( "downloadURL: %s", objDownloadURL );
        
        // then write it into the class names of the spans (objectid and downloadURL)
        // think about what happens when we don't have the objID or downloadURL...
        
        if ( objID && objDownloadURL )
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

function submitMailingJobToLob( chargeID )
{
    // Make an xhr request to the python server to create the job through the Lob API
    
    var jobCreateData = new FormData();
    jobCreateData.append('name', 'Uploaded PDF');
    jobCreateData.append('object_id', document.getElementById("objectid").className);    
    
    jobCreateData.append('to_addressName',      document.getElementsByName("destName")[0].value.trim() );
    jobCreateData.append('to_addressAddr1',     document.getElementsByName("destAddress1")[0].value.trim() );
    jobCreateData.append('to_addressAddr2',     document.getElementsByName("destAddress2")[0].value.trim() );
    jobCreateData.append('to_addressCity',      document.getElementsByName("destCity")[0].value.trim() );
    jobCreateData.append('to_addressState',     document.getElementsByName("destState")[0].value.trim() );
    jobCreateData.append('to_addressZip',       document.getElementsByName("destZip")[0].value.trim() );
    jobCreateData.append('to_addressCountry',   document.getElementsByName("destCountry")[0].value.trim() );
    
    jobCreateData.append('from_addressName',    document.getElementsByName("srcName")[0].value.trim() );
    jobCreateData.append('from_addressAddr1',   document.getElementsByName("srcAddress1")[0].value.trim() );
    jobCreateData.append('from_addressAddr2',   document.getElementsByName("srcAddress2")[0].value.trim() );
    jobCreateData.append('from_addressCity',    document.getElementsByName("srcCity")[0].value.trim() );
    jobCreateData.append('from_addressState',   document.getElementsByName("srcState")[0].value.trim() );
    jobCreateData.append('from_addressZip',     document.getElementsByName("srcZip")[0].value.trim() );
    jobCreateData.append('from_addressCountry', document.getElementsByName("srcCountry")[0].value.trim() );    
    
    var jobCreateXhr = new XMLHttpRequest();
    jobCreateXhr.onload = jobCreateReqListener;
    jobCreateXhr.open('POST', 'lob/createJob');
    jobCreateXhr.send( jobCreateData );
    
    function jobCreateReqListener()
    {
        //console.log("jobCreateReqListener responseText: %s", this.responseText);
        
        obj = JSON.parse( this.responseText );
        
        console.log( "obj.jobid: %s", obj.jobid );
        console.log( "obj.validJob: %s", obj.validJob );
        console.log( "obj.deliveryDate: %s", obj.deliveryDate );
        
        if ( obj.validJob == true )
        {
            alertSuccess( "Your PDF will be mailed shortly. Its expected delivery date is: <strong>" + obj.deliveryDate + "</strong>" );
            
            $("#downloadURL").removeClass();
            $("#objectid").removeClass();
            
            globalDropzone.removeAllFiles();
            
            //sendEmailReceipt( obj.jobid, obj.deliveryDate );
        }
        else
        {
            alertError( "Unable to create Lob job for some reason. A refund will be automatically issued." );
            
            console.log("chargeID: %s", chargeID);
            
            // If the Lob job creation or processing fails, then we need to initiate a stripe refund.
            
            var stripeRefundRequestData = new FormData();
            stripeRefundRequestData.append( 'chargeid', chargeID );
            
            function stripeRefundReqListener()
            {
                console.log( "stripeRefundReqListener (ResponseText): %s", this.responseText );
            }
            
            var stripeRefundXhr = new XMLHttpRequest();
            stripeRefundXhr.onload = stripeRefundReqListener;
            stripeRefundXhr.open( 'POST', 'stripe/issueRefund' );
            stripeRefundXhr.send( stripeRefundRequestData );
        }
    }
}

function sendEmailReceipt( jobid, deliveryDate )
{
    // Make an xhr request to the backend to log in to mailmypdf@scourcritical.com
    // Find the email with the jobid of the job that was sent to lob.
    // Forward it to the email address of the sender.
    
    var lobEmailReceiptRequestData = new FormData();
    lobEmailReceiptRequestData.append( 'srcEmail', document.getElementsByName("srcEmail")[0].value );
    lobEmailReceiptRequestData.append( 'deliveryDate', deliveryDate );
    lobEmailReceiptRequestData.append( 'jobid', jobid );
    
    function lobEmailReceiptReqListener()
    {
        console.log( "lobEmailReceiptReqListener (ResponseText): %s", this.responseText );
    }
    
    var lobEmailReceiptXhr = new XMLHttpRequest();
    lobEmailReceiptXhr.onload = lobEmailReceiptReqListener;
    lobEmailReceiptXhr.open( 'POST', 'lob/sendLobEmailReceipt' );
    lobEmailReceiptXhr.send( lobEmailReceiptRequestData );
}

$(function()
{
    $(document).bind('wroteClassData',function()
    {
        // After the class names are written into the spans, process the stripe payment.
        processPayment();
    });
    
    $( "#dropzone" ).submit(function( event )
    {
        event.preventDefault();
        globalDropzone.processQueue();
    });
    
    $('#MailMyPDFButton').on('click', function(e)
    {
        var dropzoneFileCount = globalDropzone.getAcceptedFiles().length;
        
        if ( $('#objectid').attr('class') && $('#downloadURL').attr('class') )
        {
            processPayment();
        }
        else if ( dropzoneFileCount > 0 )
        {
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
        if ( globalJobQuote == -1 )
            getJobQuote();
        else if ( globalJobQuote > -1 )
            activateStripeModal();
        else
            alertError("Weird jobquote case that probably shouldn't happen. Tell somebody.");
    }
    
    function getJobQuote()
    {
        // Make job quote request to python backend and get the price for a job using the test api key
        
        alertInfo( "Determining mailing cost..." );
        
        var jobQuoteRequestData = new FormData();
        jobQuoteRequestData.append('objectid', document.getElementById("objectid").className);
        jobQuoteRequestData.append('downloadURL', document.getElementById("downloadURL").className);
        
        jobQuoteRequestData.append('to_addressName', document.getElementsByName("srcName")[0].value.trim() );
        jobQuoteRequestData.append('to_addressAddr1', document.getElementsByName("srcAddress1")[0].value.trim() );
        jobQuoteRequestData.append('to_addressAddr2', document.getElementsByName("srcAddress2")[0].value.trim() );
        jobQuoteRequestData.append('to_addressCity', document.getElementsByName("srcCity")[0].value.trim() );
        jobQuoteRequestData.append('to_addressState', document.getElementsByName("srcState")[0].value.trim() );
        jobQuoteRequestData.append('to_addressZip', document.getElementsByName("srcZip")[0].value.trim() );
        jobQuoteRequestData.append('to_addressCountry', document.getElementsByName("srcCountry")[0].value.trim() );
        
        jobQuoteRequestData.append('from_addressName', document.getElementsByName("destName")[0].value.trim() );
        jobQuoteRequestData.append('from_addressAddr1', document.getElementsByName("destAddress1")[0].value.trim() );
        jobQuoteRequestData.append('from_addressAddr2', document.getElementsByName("destAddress2")[0].value.trim() );
        jobQuoteRequestData.append('from_addressCity', document.getElementsByName("destCity")[0].value.trim() );
        jobQuoteRequestData.append('from_addressState', document.getElementsByName("destState")[0].value.trim() );
        jobQuoteRequestData.append('from_addressZip', document.getElementsByName("destZip")[0].value.trim() );
        jobQuoteRequestData.append('from_addressCountry', document.getElementsByName("destCountry")[0].value.trim() );
        
        // console.log("objectid %s: ", document.getElementById("objectid").className);
        // console.log("downloadURL %s: ", document.getElementById("downloadURL").className);
        
        function jobQuoteReqListener()
        {
            // console.log("jobQuoteResponseUnparsed: " + jobQuote);
            // console.log("jobQuoteResponse: " + parseFloat(jobQuote));
            
            globalJobQuote = parseFloat( this.responseText );
            
            // console.log("jobPrice: %s", jobPrice);
            
            if ( globalJobQuote > -1 )
            {
                activateStripeModal();
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
    
    function activateStripeModal()
    {
        $(".alert").hide();
        
        // Convert the jobPrice from dollars into cents, then add 5 cents so we actually make money.
        var jobPrice = (globalJobQuote * 100) + 5;
        
        var handler = StripeCheckout.configure(
        {
            key: 'pk_test_qjYhk6ALhfcFYHVZBu6GIoCY', // Publishable Stripe API key.
            // key: 'pk_live_4b2UkcADEzszXLbdokQBeOPZ',
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
                    
                    // console.log("this.responseText: %s", this.responseText);
                    
                    obj = JSON.parse( this.responseText );
                    
                    // console.log("paid: %s", obj.paid);
                    
                    if ( obj.paid == true ) {
                        
                        // console.log("stripe charge paid = true");
                        
                        submitMailingJobToLob( obj.chargeid );
                    }
                    else
                        alertError( "Unable to successfully process the Stripe payment. Try again later." );
                }
                
                // console.log("tokenid: %s", token.id );
                
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
        
        $('input[name=srcEmail]').css("border-style", "solid");
        $('input[name=srcEmail]').css("border-color", "red");
        
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
        srcAddressData.append('Name', document.getElementsByName("srcName")[0].value.trim() );
        srcAddressData.append('Address1', document.getElementsByName("srcAddress1")[0].value.trim() );
        srcAddressData.append('Address2', document.getElementsByName("srcAddress2")[0].value.trim() );
        srcAddressData.append('City', document.getElementsByName("srcCity")[0].value.trim() );
        srcAddressData.append('State', document.getElementsByName("srcState")[0].value.trim() );
        srcAddressData.append('Zip', document.getElementsByName("srcZip")[0].value.trim() );
        srcAddressData.append('Country', document.getElementsByName("srcCountry")[0].value.trim() );
        
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
            
            alertInfo( "<strong>Uploading PDF file...</strong>" );
            $( "#dropzone" ).submit();
        }
        
        var destAddressData = new FormData();
        destAddressData.append('Name', document.getElementsByName("destName")[0].value.trim() );
        destAddressData.append('Address1', document.getElementsByName("destAddress1")[0].value.trim() );
        destAddressData.append('Address2', document.getElementsByName("destAddress2")[0].value.trim() );
        destAddressData.append('City', document.getElementsByName("destCity")[0].value.trim() );
        destAddressData.append('State', document.getElementsByName("destState")[0].value.trim() );
        destAddressData.append('Zip', document.getElementsByName("destZip")[0].value.trim() );
        destAddressData.append('Country', document.getElementsByName("destCountry")[0].value.trim() );
        
        var destXhr = new XMLHttpRequest();
        destXhr.onload = destReqListener;
        destXhr.open('POST', 'lob/validate');
        destXhr.send( destAddressData );
    }
    
    $(document).ready(function()
    {
        alertInfo( "To mail a PDF, first drop a file onto the page." );
        /*
        document.getElementsByName("srcName")[0].value      = "aaron hesse";
        document.getElementsByName("srcEmail")[0].value     = "aaron@scourcritical.com";
        document.getElementsByName("srcAddress1")[0].value  = "4004 houston court";
        document.getElementsByName("srcCity")[0].value      = "Concord";
        document.getElementsByName("srcState")[0].value     = "CA";
        document.getElementsByName("srcZip")[0].value       = "94521";
        
        document.getElementsByName("destName")[0].value     = "marc hesse";
        document.getElementsByName("destAddress1")[0].value = "555 w middlefield rd";
        document.getElementsByName("destAddress2")[0].value = "Apt f202";
        document.getElementsByName("destCity")[0].value     = "Mountain View";
        document.getElementsByName("destState")[0].value    = "CA";
        document.getElementsByName("destZip")[0].value      = "94043";
        */
    });
});