(function(){
  // Configuration
  var clientId = "insert-client-id";
  var facebookId = "insert-fb-id";

  var tw = "http://temanwisata.blankon.in";
  var token;
  var positionUnlocked = false;
  var positionUnlockTrial = 0;
  var here = {
    lat:-0.4147172,
    lng: 130.8267928
  };
  var rajaAmpatLoc = {
    lat: -0.59156,
    lng: 131.3090695
  };

	'use strict';
	angular.module('TemanWisataApp', ['onsen.directives','angular-carousel','leaflet-directive', "openfb", "angles"])
  .controller( "DetailCtrl", [ "$window", "$scope", "$http", "$timeout", function ($window, $scope, $http, $timeout) {
    var id = $scope.ons.navigator.getCurrentPage().options.id;

    $scope.screenWidth = $window.innerWidth-50;
    angular.element($window).bind('resize', function () {
      $scope.$apply(function () {
        $scope.screenWidth = $window.innerWidth-50;
      });
    });

    var localIcons = {
      defaultIcon: {},
      anchorIcon: {
        type: "div",
        iconSize: [30, 30],
        html: "<span class='fa fa-anchor'></span>",
        popupAnchor:  [0, 0]
      },
    }
    angular.extend($scope, {
      icons: localIcons
    });

    $scope.mapCenter = {};
    $scope.mapMarkers = {};
    console.log(id);
    var url = tw + "/api/1/features/" + id;
    var updateImages = function() {
      $scope.progressLoadingImages = false;
      $http.get(url + "/images?" + token).success(function(data) {
        $scope.imageList = [];
        for (var i = 0; i < data.length; i ++) {
          var img = data[i].filename;
          var imgUrl = tw + "/api/1/images/" + img + "?" + token;
          $scope.imageList.push({url:imgUrl}); 
        }
        $scope.progressLoadingImages = false;
      }).error(function(data) {
        $scope.progressLoadingImages = false;
      })
    }

   var processData = function(data) {
      $scope.mapCenter = {
        lat: data.geometry.coordinates[1],
        lng: data.geometry.coordinates[0],
        zoom: 8 
      }
      $scope.mapMarkers = {
        poiMarker : {
          lat: data.geometry.coordinates[1],
          lng: data.geometry.coordinates[0],
          message: data.properties.title
        }
      }

      var times = prayTimes.getTimes(new Date(), [here.lat, here.lng]);
      $scope.sunrise = times.sunrise;
      $scope.sunset = times.sunset;

    }

    var updateData = function() {
      $scope.progressLoading = true;
      $http.get(url + "?" + token).success(function(data) {
        $scope.progressLoading = false;
        processData(data);
        $scope.data = data;
        $window.localStorage["poi"+id] = JSON.stringify(data);
      }).error(function(data) {
        $scope.progressLoading = false;
        console.log(data);
      });
    }
    updateImages();
    if ($window.localStorage["poi"+id]) {
      var data = JSON.parse($window.localStorage["poi"+id]);
      processData(data);
      $scope.data = data;
    } else {
      $timeout(function() { 
        updateData();
      }, 500);
    }
  }])

  .controller( "FeatureCtrl", [ "$window", "$scope", "$http", "$timeout", function ($window, $scope, $http, $timeout) {
    var url = tw + "/api/1/features?&latlng=" + here.lat + "," + here.lng + "&dist=1000&num=30&" + token;
    var updateList = function() {
      $scope.progressLoading = true;
      $http.get(url).success(function(data) {
        for (var i = 0; i < data.length; i ++) {
          var id = data[i].id;
          data[i].image = tw + "/api/1/features/" + id + "/frontImage?" + token;
        }
        $scope.list = data;
        $window.localStorage.featureList = JSON.stringify(data);
        $scope.progressLoading = false;
      }).error(function(data) {
        $scope.progressLoading = false;
      });
    }
    $scope.refresh = function() {
      console.log("Refresh");
      if ($scope.progressLoading) {
        return;
      }
      delete($window.localStorage.featureList);
      updateList();
    }
    if ($window.localStorage.featureList) {
      return $scope.list = JSON.parse($window.localStorage.featureList);
    } else {
      $timeout(function() { updateList()}, 500);
    }
  }])
  .controller( "AccountCtrl", [ "$window", "$scope", "$http", "OpenFB", function ($window, $scope, $http, OpenFB) {

    $scope.logout = function() {
      $window.localStorage.avatarUrl = "";
      $window.localStorage.accountInfo = "";
      $scope.ons.navigator.resetToPage("login.html");
    }
    $scope.tryUnlockPosition = function() {
      console.log(positionUnlocked);
      if (positionUnlockTrial > 5) {
        positionUnlocked = true;
        positionUnlockTrial = 0;
      }
      positionUnlockTrial++;
    }


    if ($window.localStorage.accountInfo) {
      $scope.avatar = $window.localStorage.avatarUrl;
      $scope.account = JSON.parse($window.localStorage.accountInfo);
      return;
    }

    $scope.progressLoading = true;
    $scope.avatar = "images/ava.jpg";
    OpenFB.get("me").success(function(data) {
      if (data) {
        $scope.account = data;
        $window.localStorage.accountInfo = JSON.stringify(data);
      }
      OpenFB.get("me/picture?redirect=false&type=square").success(function(data) {
        if (data.data && data.data.url) {
          $scope.avatar = data.data.url;
          $window.localStorage.avatarUrl = data.data.url;
        }
        $scope.progressLoading = false;
      }).error(function(data) {
        $scope.progressLoading = false;
      });

    }).error(function(data) {
      $scope.progressLoading = false;
    });

  }])
  .controller( "LoginCtrl", [ "$window", "$scope", "$http", "OpenFB", "$timeout", function ($window, $scope, $http, OpenFB, $timeout) {
    $scope.loggingIn = false;
    OpenFB.init(facebookId, 'http://localhost:8000/oauthcallback.html', $window.localStorage);

    if ($window.localStorage.twtoken) {
      token = $window.localStorage.twtoken;
      return $scope.ons.screen.presentPage("start.html");
    }
    $scope.login = function() {
      $scope.loggingIn = true;
      $scope.loginFailed = false;
      OpenFB.login("email, publish_stream").then(
        function() {
          var data = {
            token: $window.localStorage.fbtoken
          }
          $http.post(tw + "/users/token", data).success(function(data) {
            token = "client_id="+ clientId + "&access_token=" + data.token;
            $window.localStorage.twtoken = token;
            $scope.ons.screen.presentPage("start.html");
          }).error(function(data) {
            $scope.loggingIn = false;
            $scope.loginFailed = true;
            console.log(data);
          });
        },
        function() {
          alert('Facebook login failed');
        });
    };
  }])
  .controller( "SubmitCtrl", [ "$window", "$scope", "$http", "OpenFB", function ($window, $scope, $http, OpenFB) {
    var initData = function () {
      $scope.captured = null;
      $scope.data = {
        properties: {},
        geometry: {
          type: "Point",
          coordinates: [0, 0]
        },
        categories: [],
        type: "Feature"
      }
    }

    $scope.progressLoading = true;
    var checkLocation = function(lat, lng) {
      var here = new LatLon(lat, lng);

      var dist = here.rhumbDistanceTo(new LatLon(rajaAmpatLoc.lat, rajaAmpatLoc.lng));
      console.log(dist);
      console.log(positionUnlocked);
      if (dist > 250 && positionUnlocked == false) {
        $scope.progressError = true;
        $scope.posError = 100;
      } else {
        $scope.data.geometry.coordinates = [lng, lat];
        console.log($scope.data);
      }
    }

    $scope.success = function(pos) {
      delete($scope.posError);
      delete($scope.progressError);
      $scope.progressLoading = false;

      var c = pos.coords;

      checkLocation(c.latitude, c.longitude);
      $scope.$apply();
    }


    $scope.error = function(err) {
      $scope.progressError = true;
      $scope.progressLoading = false;
      $scope.posError = err.code;
      $scope.$apply();
    }

    var uploadImages = function(id, uri) {
      var win = function (status) {
        console.log(status);

        $scope.progressSaving = false;
        $scope.savingSuccess = true;
        $scope.savingError = false;

      }
      var fail = function (status) {
        console.log(status);
        $scope.progressSaving = false;
        $scope.savingSuccess = false;
        $scope.savingError = true;
      }

      var ft = new FileTransfer();
      var server = encodeURI(tw + "/api/1/images/" + id + "?" + token);
      var options = {
        fileKey : "files[]",
        fileName : uri.substr(uri.lastIndexOf('/') + 1),
        mimeType : "image/jpeg"
      }
      ft.upload(uri, server, win, fail, options);
    }

    $scope.submitFeature = function() {
      var url = tw + "/api/1/features?";
      $scope.progressSaving = true;
      delete($scope.savingSuccess);
      delete($scope.savingError);
      $http.post(url + token, $scope.data).success(function(data) {
        console.log(data);
        console.log(data.id);
        if ($scope.captured) {
          uploadImages(data.id, $scope.captured);
        } else {
          $scope.progressSaving = false;
          $scope.savingSuccess = true;
          $scope.savingError = false;
        }
        initData();
      }).error(function(data) {
        $scope.progressSaving = false;
        $scope.savingSuccess = false;
        $scope.savingError = true;
      });
    }

    $scope.getPictures = function() {
      var onCaptured = function(uri) {
        console.log(uri);
        $scope.captured = uri;

      }
      
      var onFailed = function(err) {
        console.log(err);
      }

      navigator.camera.getPicture(onCaptured, onFailed, {
        quality: 100,
      sourceType: Camera.PictureSourceType.PHOTOLIBRARY,
        destinationType: Camera.DestinationType.NATIVE_URI
      });
    }

    initData();
    if (positionUnlocked) {
      $scope.success({
        coords: {
          latitude: here.lat,
          longitude: here.lng
        }
      } );
    } else {
      $window.navigator.geolocation.getCurrentPosition($scope.success, $scope.error) ;
    }
  }])
})()
