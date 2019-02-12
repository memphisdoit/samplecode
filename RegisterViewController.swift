//
//  RegisterViewController.swift
//  Memphis
//

import UIKit
import Alamofire

class RegisterViewController: BaseViewController {

    @IBOutlet weak var titleConstraint: NSLayoutConstraint!
    @IBOutlet weak var titleLabel: UILabel!
    @IBOutlet weak var emailField: UITextField!
    @IBOutlet weak var usernameField: UITextField!
    @IBOutlet weak var passwordField: UITextField!
    @IBOutlet weak var confirmField: UITextField!
    @IBOutlet weak var inviteField: UITextField!
    @IBOutlet weak var signUpButton: UIButton!
    @IBOutlet weak var singInButton: UIButton! {
        didSet {
            let attrbs : [NSAttributedString.Key : Any]
                = [NSAttributedString.Key.font : UIFont.lato(.regular, size: 18.0),
                   NSAttributedString.Key.foregroundColor : UIColor.white,
                   NSAttributedString.Key.underlineStyle : NSUnderlineStyle.single.rawValue]
            let name = NSAttributedString(string: "Sign In", attributes: attrbs)
            singInButton.setAttributedTitle(name, for: .normal)
        }
    }
    
    private var defaultConstrainHeight: CGFloat = 40.0
    private var moveDelta: CGFloat = -36.0
    private var registerModel: RegisterModel!
    
    // MARK: - View Life Cycle
    
    override func viewDidLoad() {
        super.viewDidLoad()
        allowHidingKeyboard()
        
        // UI fix for SE & 5S iPhones
        if isPhoneSE {
            titleConstraint.constant = 18.0
            defaultConstrainHeight = 18.0
            titleLabel.font = UIFont.lato(.regular, size: 18)
        }
        
        // Registering observer for keyboard notifications
        notificationCenter.addObserver(self,
                                       selector: #selector(animateWithKeyboard(notification:)),
                                       name: UIResponder.keyboardWillShowNotification,
                                       object: nil)
        notificationCenter.addObserver(self,
                                       selector: #selector(animateWithKeyboard(notification:)),
                                       name: UIResponder.keyboardWillHideNotification,
                                       object: nil)
    }
    
    deinit {
        // Removing keyboards observer
        notificationCenter.removeObserver(self)
    }
    
    // MARK: - Functions
    
    // Animation for keyboard when it shows/hides
    @objc func animateWithKeyboard(notification: NSNotification) {
        let moveUp = (notification.name == UIResponder.keyboardWillShowNotification)
        titleConstraint.constant = moveUp ? moveDelta : defaultConstrainHeight
        UIView.animate(withDuration: kDefaultAnimationDuration) {
            self.view.layoutIfNeeded()
        }
    }

    // Checking fields validation
    private func areFieldsValid() -> Bool {
        guard let email = emailField.text, email.isValidEmail() else {
            showAlert("Invalid email", text: "Please check the email and try again")
            return false
        }
        guard let username = usernameField.text, username.isValidCommonField() else {
            showAlert("Invalid username", text: "Please check the username and try again")
            return false
        }
        guard let password = passwordField.text, password.isValidPassword() else {
            showAlert("Invalid password", text: "Please check the password and try again")
            return false
        }
        guard let confirmPassword = confirmField.text, confirmPassword.isValidPassword() else {
            showAlert("Invalid confirm password", text: "Please check the confirm password and try again")
            return false
        }
        guard let inviteCode = inviteField.text, inviteCode.isValidCommonField() else {
            showAlert("Invalid invite code", text: "Please check the invite code and try again")
            return false
        }
        if password != confirmPassword {
            showAlert("Passwords do not match", text: "Please check the passwords and try again")
            return false
        }
        if inviteCode != "welcome" {
            showAlert("Invalid invite code", text: "Please check the invite code and try again")
            return false
        }
        
        // Saving register model
        registerModel = RegisterModel()
        registerModel.email = email
        registerModel.password = password
        registerModel.username = username
        registerModel.inviteCode = inviteCode
        return true
    }
    
    // Sing un functions with saving user data
    func signUp() {
        if !Network.isReachable {
            showAlert("No internet connection", text: "Please check Network Settings")
            return
        }
        showHUD()
        print("Sign UP with \(String(describing: registerModel))")
        let params = ["email": registerModel.email,
                      "password": registerModel.password,
                      "name": registerModel.username,
                      "device_id": Settings.pushToken() ?? deviceID]
        // Making signup request
        Network.shared.request(.signUp(body: params)) { (json, error) in
            self.hideHUD()
            if let err = error {
                self.showAlert(text: err.localizedDescription)
                return
            }
            // Return to login with explanation alert
            self.showAlert("Activate your account", text: "Please check your email for more instructions")
            AppDelegate.shared.root.switchToLogin()
        }
    }
    
    // MARK: - IB Actions
    
    @IBAction func singUpPressed(_ sender: Any) {
        if areFieldsValid() {
            signUp()
        }
    }
    
    @IBAction func singInPressed(_ sender: Any) {
        AppDelegate.shared.root.switchToLogin()
    }
    
}

// MARK: - UITextFieldDelegate Delegate

extension RegisterViewController: UITextFieldDelegate {
    
    // Done button actions
    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        if textField == emailField {
            usernameField.becomeFirstResponder()
        }
        if textField == usernameField {
            passwordField.becomeFirstResponder()
        }
        if textField == passwordField {
            confirmField.becomeFirstResponder()
        }
        if textField == confirmField {
            inviteField.becomeFirstResponder()
        }
        if textField == inviteField {
            textField.resignFirstResponder()
            if areFieldsValid() {
                signUp()
            }
        }
        return false
    }
    
    // Trimming spaces from text fields
    func textFieldDidEndEditing(_ textField: UITextField) {
        if let text = textField.text {
            let trimmedText = text.trimmingCharacters(in: .whitespaces)
            textField.text = trimmedText
        }
    }
    
}
