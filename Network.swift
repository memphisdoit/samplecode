//
//  Network.swift
//  Memphis

import Foundation
import Alamofire
import SwiftyJSON

// MARK: - Request Protocol

protocol RequestProtocol {
    var baseURL: String { get }
    var path: Path { get }
    var fullURL: String { get }
    var encoding: ParameterEncoding { get }
    var method: HTTPMethod { get }
    var headers: HTTPHeaders { get }
    var parameters: Parameters { get }
    var queryID: String? { get }
}

// MARK: - Network class

@objc class Network: NSObject {
    
    // Shared istance to work with
    @objc static let shared = Network()
    
    // Network's session & reachability managers
    var sessionManager: SessionManager!
    private var reachabilityManager: NetworkReachabilityManager! = NetworkReachabilityManager()
    
    // Current request for canceling or etc
    var currentRequest: Request?
    
    // Reachability check
    class var isReachable: Bool {
        return NetworkReachabilityManager()!.isReachable
    }
    
    // Initializing session & managers
    func setup() {
        let config = URLSessionConfiguration.default
        sessionManager = SessionManager(configuration: config)
        
        // reachablity
        reachabilityManager.listener = { status in
            print("Network Status Changed: \(status)")
            notificationCenter.post(name: kReachibilityChanged,
                                    object: status)
        }
        reachabilityManager.startListening()
        
    }
    
    // Main request method to use universally
    func request(_ request: APIRequest, completion: @escaping APIResponse) {
        self.currentRequest = self.sessionManager.request(request.fullURL,
                                                          method: request.method,
                                                          parameters: request.parameters,
                                                          encoding: request.encoding,
                                                          headers: request.headers)
            .validate()
            .responseData { response in
                // Status code checkings
                self.currentRequest = nil
                let statusCode = response.response?.statusCode ?? -1000
                print("Status Code: ", statusCode)
                
                // Result maintaining
                switch response.result {
                case .success(let value):
                    let json = JSON(value)
                    completion(json, nil)
                    // clearing Network's current request
                    self.currentRequest = nil
                case .failure(let error):
                    // if data hase error message than custom error is made with description
                    if let data = response.data {
                        let errJson = JSON(data)
                        var errMessage = errJson["message"].stringValue
                        if errMessage.isEmpty {
                            errMessage = "Something went wrong, please try again later"
                        }
                        let err = NSError(domain: "network",
                                code: statusCode,
                                userInfo: [NSLocalizedDescriptionKey: errMessage])
                        print("Error:", err)
                        completion(JSON.null, err)
                        // clearing Network's current request
                        self.currentRequest = nil
                    } else {
                        print("Error: ", error)
                        completion(JSON.null, error)
                        // clearing Network's current request
                        self.currentRequest = nil
                    }
                }
        }
        // setting Network's current request
        if let request = self.currentRequest {
            print(request.description)
        }
    }
    
}

// MARK: - Request's enum parameters & values

enum Path: String {
    case signIn = "signin"
    case signUp = "signup"
    case logout = "logout"
    case userDevice = "user/deviceId"
    case mosaics = "mosaics"
    case mosaicsList = "mosaicsList"
    case resetPassword = "forgot_password"
}

enum APIRequest {
    case signIn(body: Parameters)
    case signUp(body: Parameters)
    case logout(queryID: String)
    case registerDevice(token: String)
    case collections(userID: String)
    case collectionsList()
    case resetPassword(body: Parameters)
}

// MARK: - RequestProtocol - URLs extension

extension RequestProtocol {
    
    var baseURL: String {
        return serverURL
    }
    
    var fullURL: String {
        var url = baseURL + "api/v1/" + path.rawValue
        if let qid = queryID {
            url = "\(url)/\(qid)"
        }
        return url
    }
    
}

// MARK: - RequestProtocol - APIRequest parameters

extension APIRequest: RequestProtocol {
    
    var path: Path {
        switch self {
        case .signIn:
            return .signIn
        case .signUp:
            return .signUp
        case .logout:
            return .logout
        case .registerDevice:
            return .userDevice
        case .collections:
            return .mosaics
        case .collectionsList:
            return .mosaicsList
        case .resetPassword:
            return .resetPassword
        }
    }
    
    var method: HTTPMethod {
        switch self {
        case .signIn, .signUp, .resetPassword:
            return .post
        case .logout, .registerDevice:
            return .put
        default:
            return .get
        }
    }
    
    var encoding: ParameterEncoding {
        switch self {
        case .signIn, .signUp, .resetPassword:
            return JSONEncoding.default
        default:
            return URLEncoding.default
        }
    }
    
    var parameters: Parameters {
        var parameters: Parameters
        switch self {
        case .signIn(let body):
            parameters = body
        case .signUp(let body):
            parameters = body
        case .collections(let userID):
            parameters = ["userId": userID]
        case .resetPassword(let body):
            parameters = body
        default:
            parameters = Parameters()
        }
        if !parameters.isEmpty {
            print("parameters: \(parameters)")
        }
        return parameters
    }
    
    var queryID: String? {
        switch self {
        case .logout(let queryID):
            return queryID
        case .registerDevice(let token):
            return token
        default:
            return nil
        }
    }
    
    var headers: HTTPHeaders {
        var headers = HTTPHeaders()
        switch self {
        case .signIn, .signUp, .resetPassword:
            break
        default:
            if let accessToken = Settings.accessToken() {
                headers["Authorization"] = "Bearer " + accessToken
            }
        }
        return headers
    }
    
}

// MARK: - Network extesnions

extension Network {
    
    // Registering device ID with push token on backend
    class func registerPushToken() {
        if let pushToken = Settings.pushToken() {
            Network.shared.request(.registerDevice(token: pushToken)) { (json, error) in
                if let err = error {
                    print(err)
                    return
                }
            }
        }
    }
    
    // Download function
    func download(_ url: String, completion: @escaping Completion) {
        let destination = DownloadRequest.suggestedDownloadDestination(for: .documentDirectory)
        self.sessionManager.download(url, to: destination)
            .responseData(completionHandler: { (dataResponse) in
                switch dataResponse.result {
                case .success:
                    completion(nil)
                case .failure(let error):
                    print("Error: ", error)
                    completion(error)
                }
            })
    }
    
}
