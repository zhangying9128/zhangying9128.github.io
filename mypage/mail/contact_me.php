<?php

if(empty($_POST['name'])  		||
   empty($_POST['email']) 		||
   empty($_POST['message']))
   {
	return false;
   }
	
$name = $_POST['name'];
$email_address = $_POST['email'];
$message = $_POST['message'];


// Create the email and send the message
$to = '451982246@qq.com'; // Add your email address inbetween the '' replacing yourname@yourdomain.com - This is where the form will send a message to.
$email_subject = "Website Contact From:  $name";
$email_body = "You have received a new message from your website contact form.\n\n"."Here are the details:\n\nName: $name\n\nEmail: $email_address\n\nMessage:\n$message";
$headers = "From: noreply@yourdomain.com\n"; // This is the email address the generated message will be from. We recommend using something like noreply@yourdomain.com.
$headers .= "Reply-To: $email_address";	
 

 
// This example shows making an SMTP connection with authentication.

//Import the PHPMailer class into the global namespace
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
//SMTP needs accurate times, and the PHP time zone MUST be set
//This should be done in your php.ini, but this is how to do it if you don't have access to that
date_default_timezone_set('Etc/UTC');
require '/../PHPMailer/PHPMailer/src/Exception.php';
require '/../PHPMailer/PHPMailer/src/PHPMailer.php';
require '/../PHPMailer/PHPMailer/src/SMTP.php';
//Create a new PHPMailer instance
$mail = new PHPMailer;
//Tell PHPMailer to use SMTP
$mail->isSMTP();
//Enable SMTP debugging
// 0 = off (for production use)
// 1 = client messages
// 2 = client and server messages
$mail->SMTPDebug = 2;
//Set the hostname of the mail server
$mail->Host = 'smtp.qq.com';
//Set the SMTP port number - likely to be 25, 465 or 587
$mail->Port = 465;
//Whether to use SMTP authentication
$mail->SMTPAuth = true;
//Username to use for SMTP authentication
$mail->Username = '451982246@qq.com';
//Password to use for SMTP authentication
$mail->Password = 'jxvryvvmpvkzcbea'; //
//Set who the message is to be sent from
$mail->setFrom('451982246@qq.com', 'First Last');
//Set an alternative reply-to address
$mail->addReplyTo($to, 'First Last');
//Set who the message is to be sent to
$mail->addAddress($to, 'John Doe');
//Set the subject line
$mail->Subject = $email_subject;
$mail->Body    = $email_body;
$mail->SMTPSecure = 'ssl';
if( !$mail->send()){
	echo "error";
}
else{
	echo "Messege has been delivered, thank you";
}

?>