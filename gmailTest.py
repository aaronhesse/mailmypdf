import imaplib
import smtplib
import email
import re

# Use IMAP4 to login to the gmail server for the mailmypdf email account.
# List the contents of the inbox, then search for the email containing the
# jobId that was created by Lob.

mailmypdf = {
    'username': 'mailmypdf@scourcritical.com',
    'password': 'wc5Yz#guPF&e'
}

mail = imaplib.IMAP4_SSL( 'imap.gmail.com' )
mail.login( mailmypdf['username'], mailmypdf['password'] )
mail.select( 'inbox' )

msg = ''

typ, data = mail.search( None, 'ALL' )
for num in data[0].split():
    typ, data = mail.fetch( num, '(RFC822)' )
    for response_part in data:
        if isinstance( response_part, tuple ):
            match = re.search( '(job_c38b87a3fc13a626)', response_part[1] )
            if match:
                emailMessage = email.message_from_string( response_part[1] )
                for part in emailMessage.walk():
                    if part.get_content_type() == 'text/plain':
                        msg = part.get_payload()

mail.close()
mail.logout()

# Connect to the gmail SMTP server and send the email to the user who created
# the lob job.

toAddress   = 'aaron@scourcritical.com'
fromAddress = mailmypdf['username']
server      = smtplib.SMTP('smtp.gmail.com:587')

server.starttls()
server.login( mailmypdf['username'], mailmypdf['password'] )
server.sendmail( fromAddress, toAddress, msg )
server.quit()