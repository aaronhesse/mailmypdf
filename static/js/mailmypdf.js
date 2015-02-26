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

var handler = StripeCheckout.configure({
    key: 'pk_test_qjYhk6ALhfcFYHVZBu6GIoCY', // Publishable Stripe API key.
    image: 'static/adobe.png',
    name: 'MailMyPDF',
    description: 'Physically mailing a PDF file',
    amount: 159,
    token: function(token)
    {
        // The checkout payment form has been submitted.
        
        function paymentReqListener()
        {
            // The stripe payment is now complete/successful.
            alertInfo( "<strong>Submitting PDF file...</strong>" );
            $( "#dropzone" ).submit();
        }
        
        var paymentData = new FormData();
        paymentData.append('tokenid', token.id);
        paymentData.append('amount', 159);
        paymentData.append('description', "payinguser@example.com");
        
        var paymentXhr = new XMLHttpRequest();
        paymentXhr.onload = paymentReqListener;
        paymentXhr.open('POST', 'stripe/processPayment');
        paymentXhr.send( paymentData );
    }
});

$(window).on('popstate', function(){
    closeStripeModal();
});

var globalDropzone;

Dropzone.options.dropzone = {
  
  autoProcessQueue: false,
  uploadMultiple: false,
  parallelUploads: 1,
  maxFiles: 1,
  paramName: "file",
  clickable: false,
    
  init: function() {
    globalDropzone = this;
    
    this.on("addedfile", function(file)
    {
        // todo: if the alert is of class info? or if it's telling the user to drop a file on the form
        $(".alert").hide();
    });
    
      
    this.on("error", function(file, message)
    {
        console.log('dropzone error message: ' + message);
        alertError( "Dropzone had an error of some kind." );
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

$(function()
{
    $( "#dropzone" ).submit(function( event )
    {
      event.preventDefault();
      
      globalDropzone.processQueue();
      
      globalDropzone.on("complete", function(file)
      {
            var dropzoneFile = file;
            function jobReqListener()
            {
                if ( this.responseText == "True" )
                {
                    // TODO: make the "Send Another" a link that clears the form fields and removes all files from the dropzone.
                    alertSuccess( "Your PDF will be mailed shortly. Send Another?" );
                    $("#jobid").removeClass();
                    globalDropzone.removeFile( dropzoneFile );
                }
                else
                {
                    var localhostWarning;
                    if (document.location.hostname == "localhost")
                        localhostWarning = "<strong>localhost</strong>";
                    
                    alertError( "Unable to create Lob job for some reason. " + localhostWarning );
                    $("#jobid").removeClass(); // is this required here?
                }
            }
            
            var jobData = new FormData();
            jobData.append('jobid', document.getElementById("jobid").className);
            
            var srcXhr = new XMLHttpRequest();
            srcXhr.onload = jobReqListener;
            srcXhr.open('POST', 'lob/validateJob');
            srcXhr.send( jobData );
      });
    });
    
    $('#MailMyPDFButton').on('click', function(e) {
        var dropzoneFileCount = globalDropzone.getAcceptedFiles().length;
        
        if ( dropzoneFileCount > 0 )
            validateAddresses();
        else
            alertError("Please attach a file first.");
        
        e.preventDefault();
    });
    
    $('.close').click(function()
    {
        $(".alert").hide();
    });
    
    function stripeResponseHandler(status, response)
    {
        /*
        console.log('inside the stripe response handler function!');
        alert('inside stripe response handler function!');
        
        var $form = $('#payment-form');
        
        if ( response.error )
        {
            $form.find('.payment-errors').text(response.error.message);
            $form.find('button').prop('disabled', false);
        }
        else
        {
            // response contains id and card, which contains additional card details
            // Insert the token into the form so it gets submitted to the server (our server)
            // and submit the stripe payment form to be processed by our python server
            
            var token = response.id;
            $form.append($('<input type="hidden" name="stripeToken" />').val(token));
            $form.get(0).submit();
        }
        */
    }
    
    function activateStripeModal()
    {
        $(".alert").hide();
        handler.open();
    }
    
    function validateAddresses()
    {
        // validateSourceAddress will end up calling validateDestinationAddress()
        validateSourceAddress();
    }
    
    function validateSourceAddress()
    {
        function srcReqListener()
        {
            if ( this.responseText == "False" )
            {
                alertError( "Originating address is not valid." );
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
                alertError( "Destination address is not valid." );
                return;
            }
            
            // TODO: find some way to decouple this from the address validation code.
            activateStripeModal();
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
    
    $(document).ready(function(){ alertInfo( "To mail a PDF, first drop a file onto the form." ); });
});