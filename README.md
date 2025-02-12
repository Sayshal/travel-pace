# travel-pace

A simple module that calculates the travel time for D&amp;D5e players. it's just a module I'm using to learn how to make modules for foundry.

- Use the information described in pg.84 of the OGL as a calculation rule.
- (tips) Use the lowest speed of the group in feet as a reference.
- (tips) It is implicit that you consider any terrain that does not consist of a road or trail as difficult terrain.

# Manifest

`https://raw.githubusercontent.com/rinnocenti/travel-pace/master/module.json`

## How to Use

### Settings

<img src="https://github.com/rinnocenti/travel-pace/blob/master/img/readme01.jpg" width="70%" height="70%">

#### Forced March on Chat

By activating this setting, a forced march rules message will be sent to the chat to alert players of the forced march rules. Disabling this message is not displayed in the chat.

#### Convert to Metric System

if you have a module that changes the measurement values for the metric system, you can also convert the module to the system, enabling this field

### On Map

<img src="https://github.com/rinnocenti/travel-pace/blob/master/img/readme02.jpg" width="70%" height="70%">
In the basic control bar there will be a button called Travel Pace, when clicking a dialog screen will appear.

#### Lowest group speed feets

Enter the speed of the group. Ideally, it should be the lowest speed among everyone in the group.

#### Miles on the road/trails

Enter here the distance traveled by the players on the roads or trails. Basically this field considers any movement on NOT difficult terrain

#### Miles on the road/trails

Enter here the distance traveled by the players off the roads or trails. Basically this field considers any movement on the difficult terrain

#### Speed Ratio

sometimes on certain types of land speed is further reduced, usually the players do three miles per hour. however, this average can be changed according to the ground rules.

- Normal (SRD) -> 3 mi/h
- 1/2 Normal -> 1.5 mi/h
- 1/4 Normal -> 0.75 mi/h
- 1/6 Normal -> 0.5 mi/h - ( rules of Icewind Dale: Rime of the Frostmaiden)

#### Estimated Hours

It will display a time estimate for the displayed configuration.It will display a time estimate for the displayed configuration. Presenting the time in the 3 gears, Normal, fast
and slow, together with the rules of each one.

#### Forced March

A summary of the forced march rules, if you selected in the settings to display forced march, this text will be sent together with the proposed march for the chat.

#### Buttons

decided which type of gear will be used the player / master presses one of the buttons and a summary of the choices will be sent to the chat.

### On Chat

<img src="https://github.com/rinnocenti/travel-pace/blob/master/img/readme03.jpg" width="50%" height="50%">
A message will be sent to the chat with a description of what was chosen. containing some information:

- Who measure.
- With rate used.
- Many miles in Dificult and Normal terrain
- Estimatade time
- Days for compleat the journey (by rule players can only travel for 8h a day, without the use of forced march.)
- Nonus and Penalties
- (Optional) Rules of Forced March.

## Support

If you like this module and would like to help or found a bug or request new features call me on discord @Innocenti#1455 or create a issue here.

## License

This Foundry VTT module, writen by Innocenti, is licensed under a Creative Commons Attribution 4.0 International License.

# Feedback

For bugs/feedback, create an issue on GitHub, or contact me on Discord at Innocenti#1455
