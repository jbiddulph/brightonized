import { ViewChild, ElementRef, Injectable} from '@angular/core';
import { NavController, LoadingController, ToastController, ModalController, ActionSheetController, AlertController } from 'ionic-angular';
import firebase from 'firebase';
import moment from 'moment';
import { LoginPage } from '../login/login';
import { Camera, CameraOptions } from '@ionic-native/camera';
import { HttpClient } from '@angular/common/http';
import { Geolocation } from '@ionic-native/geolocation';
import { CommentsPage } from '../comments/comments';
import { MapPage } from '../map/map';
import { Firebase } from '@ionic-native/firebase';


@Injectable()
export class FeedService {
  @ViewChild('map') mapElement: ElementRef;
  posts: any[] = [];
  cursor: any;
  pageSize: number = 10;
  text: string = "";
  image: string;
  infiniteEvent: any;

  constructor(
    public navCtrl: NavController,
    private loadingCtrl: LoadingController,
    private firebaseCordova: Firebase,
    private toastCtrl: ToastController,
    private modal: ModalController,
    private camera: Camera,
    private geolocation: Geolocation,
    private http: HttpClient,
    private alertCtrl: AlertController,
    private actionSheetCtrl: ActionSheetController){
    this.firebaseCordova.getToken().then((token) => {
      console.log('this is the token', token);
      this.updateToken(token, firebase.auth().currentUser.uid);
    }).
    catch((err) => {
      console.log(err);
    })
  }

  updateToken(token: string, uid: string) {
    firebase.firestore().collection("users").doc(uid).set({
      token: token,
      tokenUpdate: firebase.firestore.FieldValue.serverTimestamp()
    }, {
      merge: true
    }).then(() => {
      console.log("Token saved to cloud firestore")
    }).catch((err) => {
      console.log('this is the error: ',err);
    })
  }

  openModal(post) {
    this.modal.create(MapPage, {
      "thepost": post
    }).present();
  }

  refresh(event){
    this.posts = [];

    this.getPosts();
    if(this.infiniteEvent){
      this.infiniteEvent.enable(true);
    }
    event.complete();
  }

  ago(time) {
    let difference = moment(time).diff(moment());
    return moment.duration(difference).humanize();
  }

  logout() {
    firebase.auth().signOut().then(() => {
      let toast = this.toastCtrl.create({
        message: "You have logged out successfully.",
        duration: 3000
      }).present();
      this.navCtrl.setRoot(LoginPage)
    });
  }

  comment(post) {
    this.actionSheetCtrl.create({
      buttons: [
        {
          text: "View All Comments",
          handler: () => {
            this.modal.create(CommentsPage, {
              "post": post
            }).present();
          }
        },
        {
          text: "New Comment",
          handler: () => {
            this.alertCtrl.create({
              title: "New Comment",
              message: "type your message",
              inputs: [
                {
                  name: "comment",
                  type: "text"
                }
              ],
              buttons: [
                {
                  text: "Cancel",
                },
                {
                  text: "Post",
                  handler: (data) => {
                    if(data.comment){
                      firebase.firestore().collection("comments").add({
                        text: data.comment,
                        post: post.id,
                        owner: firebase.auth().currentUser.uid,
                        owner_name: firebase.auth().currentUser.displayName,
                        created: firebase.firestore.FieldValue.serverTimestamp()
                      }).then((doc) => {
                        this.toastCtrl.create({
                          message: "Comment posted successfully!",
                          duration: 3000
                        }).present();
                      }).catch((err) => {
                        this.toastCtrl.create({
                          message: err.message,
                          duration: 3000
                        }).present();
                      })
                    }
                  }
                }
              ]
            }).present();
          }
        }
      ]
    }).present();
  }


  launchCamera() {
    let options: CameraOptions = {
      quality: 90,
      sourceType: this.camera.PictureSourceType.CAMERA,
      destinationType: this.camera.DestinationType.DATA_URL,
      encodingType: this.camera.EncodingType.PNG,
      mediaType: this.camera.MediaType.PICTURE,
      correctOrientation: true,
      targetHeight: 512,
      targetWidth: 512,
      allowEdit: true

    }
    this.camera.getPicture(options).then((toBase64String) => {
      console.log(toBase64String)
      this.image = "data:image/png;base64," + toBase64String
      console.log(this.image)
    })
  }

  launchLibrary() {
    let options: CameraOptions = {
      quality: 90,
      sourceType: this.camera.PictureSourceType.PHOTOLIBRARY,
      destinationType: this.camera.DestinationType.DATA_URL,
      encodingType: this.camera.EncodingType.JPEG,
      mediaType: this.camera.MediaType.PICTURE,
      correctOrientation: true,
      targetHeight: 512,
      targetWidth: 512,
      allowEdit: true

    }
    this.camera.getPicture(options).then((toBase64String) => {
      console.log(toBase64String)
      this.image = "data:image/png;base64," + toBase64String
      console.log(this.image)
    })
  }

  like(post) {
    let body = {
      postId: post.id,
      userId: firebase.auth().currentUser.uid,
      action: post.data().likes && post.data().likes[firebase.auth().currentUser.uid] == true ? "unlike" : "like"
    }

    let toast = this.toastCtrl.create({
      message: "Liking post"
    });
    toast.present();
    // console.log("here is the PostID: ", post.id)
    // console.log("here is the userID: ", firebase.auth().currentUser.uid)
    // console.log("here is the PostID: ", post.data().likes && post.data().likes[firebase.auth().currentUser.uid] == true ? 'unlike' : 'like')
    this.http.post("https://us-central1-quotes-cc05d.cloudfunctions.net/updateLikesCount", body, {
      responseType: "text"
    }).subscribe((data) => {
      toast.setMessage("LIKED!")
      setTimeout(() => {
        toast.dismiss();
      }, 3000)
    }, (error) => {
      toast.setMessage("An error has occured, please try again later!")
      setTimeout(() => {
        toast.dismiss();
      }, 3000)
      console.log("here is the error: ", error)
    })
  }

  upload(name: string) {
    return new Promise((resolve, reject) => {
      let loading = this.loadingCtrl.create({
        content: "Uploading Image..."
      })
      loading.present()



      let ref = firebase.storage().ref("postImages/" + name);
      let uploadTask = ref.putString(this.image.split(',')[1], "base64");
      uploadTask.on("state_changed", (taskSnapshot: any) => {
        console.log(taskSnapshot)
        let percentage = taskSnapshot.bytesTransferred / taskSnapshot.totalBytes * 100;
        loading.setContent("Uploaded " + percentage + "%...")
      }, (error) => {
        console.log(error)
      }, () => {
        console.log("upload complete")
        this.geolocation.getCurrentPosition().then((resp) => {

          resp.coords.latitude
          resp.coords.longitude
          console.log(resp.coords.latitude)
          firebase.firestore().collection("posts").doc(name).update({
            latitude: resp.coords.latitude,
            longitude: resp.coords.longitude
          })
        }).catch((error) => {
          console.log('Error getting location', error);
        });
        uploadTask.snapshot.ref.getDownloadURL().then((url) => {

          firebase.firestore().collection("posts").doc(name).update({
            image: url
          }).then(() => {
            loading.dismiss()
            resolve()
          }).catch(() => {
            loading.dismiss()
            reject()
          })
        }).catch(() => {
          loading.dismiss()
          reject()
        })
      })
    })
  }

  post() {
    firebase.firestore().collection("posts").add({
      text: this.text,
      created: firebase.firestore.FieldValue.serverTimestamp(),
      owner: firebase.auth().currentUser.uid,
      owner_name: firebase.auth().currentUser.displayName
    }).then(async (doc) => {
      if(this.image) {
        await this.upload(doc.id)
      }
      this.text = "";
      this.image = undefined

      let toast = this.toastCtrl.create({
        message: "Your post has been created successfully.",
        duration: 3000
      }).present();
      this.getPosts()
    }).catch((err) => {
      console.log(err)
    })
  }
  loadMorePosts(event) {
    firebase.firestore().collection("posts").orderBy("created", "desc").startAfter(this.cursor).limit(this.pageSize).get()
      .then((docs) => {
        docs.forEach((doc) => {
          this.posts.push(doc)
        })
        if(docs.size < this.pageSize){
          event.enable(false);
          this.infiniteEvent = event;
        } else {
          event.complete();
          this.cursor = this.posts[this.posts.length -1];
        }

      }).catch((err) => {
      console.log(err)
    })
  }

  getPosts() {

    this.posts = []
    let loading = this.loadingCtrl.create({
      content: "Loading Feed..."
    })
    loading.present()
    let query = firebase.firestore().collection("posts").orderBy("created", "desc").limit(this.pageSize)


    query.onSnapshot((snapshot) => {
      let changedDocs = snapshot.docChanges();

      changedDocs.forEach((change) => {
        if(change.type == "added"){
          //TODO
        }
        if(change.type == "modified"){
          //TODO
          for(let i = 0; i < this.posts.length; i++){
            if(this.posts[i].id == change.doc.id){
              this.posts[i] = change.doc;
            }
          }
        }
        if(change.type == "removed"){
          //TODO
        }
      })
    })



    query.get()
      .then((docs) => {

        docs.forEach((doc) => {
          this.posts.push(doc)

        })
        loading.dismiss()

        this.cursor = this.posts[this.posts.length -1];

      }).catch((err) => {
      console.log(err)
    })
  }
}
