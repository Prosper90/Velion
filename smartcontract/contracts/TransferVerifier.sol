// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract TransferGroth16Verifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 7143244691896148442229410933133728973559956127159758747125603604867790776860;
    uint256 constant alphay  = 8417694375309591126621098042418373129299143629337231962131853280734001532350;
    uint256 constant betax1  = 20051057658890430645298014211094317456072789576176215423753949856660668381238;
    uint256 constant betax2  = 7590698765985390118070914852736623587055729841722924675548424647846259709461;
    uint256 constant betay1  = 12823571529436820973278148202425595496676223026986465925603468513310786454997;
    uint256 constant betay2  = 5748865814348440662544460816487531167806696840367964450236437029458903873743;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 13227088127317834003071781215739281260008180772176193118885475676647540451156;
    uint256 constant deltax2 = 7192272850498460534047845884627206970631999969420495301812480974110907849137;
    uint256 constant deltay1 = 11640155669326337499432570810885986649179650994726375558042143924701581211200;
    uint256 constant deltay2 = 15414757907061498715301753500719110548983191295697278624811925647999674895255;

    
    uint256 constant IC0x = 2808740655385350216725075450401631419975890316138888249220144674668082945176;
    uint256 constant IC0y = 13348007867988734950506889761905898122091787030955736672812826876833969111162;
    
    uint256 constant IC1x = 20725725352910055507695638133038804787650201685491410136692458582176200565774;
    uint256 constant IC1y = 21102814140583133959759606828519990825155537310455285822466478522639252086739;
    
    uint256 constant IC2x = 20249590095481753492504234331918515210792372022371948399075309876531592180583;
    uint256 constant IC2y = 19188579632328981500044090448665167796272733405390786273522272064716842693845;
    
    uint256 constant IC3x = 1865614391782477274446523527653833028170907989101024850659015089810115825926;
    uint256 constant IC3y = 4244212034748964873563015147272126352405877489488429934245264603406927002760;
    
    uint256 constant IC4x = 16750794414038404717016019870699855037426585891790935688359807907409611192166;
    uint256 constant IC4y = 7432081775500767513812745303273856438831023512525674518581741722725340226442;
    
    uint256 constant IC5x = 5199954047673554083776291860839912017030535945989457445767240855030393324879;
    uint256 constant IC5y = 10280377079757058064383589660015406890260896838243695887361555426698312753402;
    
    uint256 constant IC6x = 8405884843188113728209452852746737365617610554236329964568602617236704744848;
    uint256 constant IC6y = 18746251891016538024851008035542571075134314979957253944699704445911755907042;
    
    uint256 constant IC7x = 13477937355086859255507031883615821491980852315449789370644506782699678802886;
    uint256 constant IC7y = 638612353047951532748352226840500426757467476439434338224361762872170648212;
    
    uint256 constant IC8x = 20466941932787892296230431313000316830577924915780364342114117153038315826450;
    uint256 constant IC8y = 14457526193140484457592104608306064177483754624954044135352166381258590855981;
    
    uint256 constant IC9x = 5888421045348779425468487863279686744693690442349815290665435251165480460363;
    uint256 constant IC9y = 993727136485759544099574425767771653942688543687293433093020558914977447178;
    
    uint256 constant IC10x = 20199661512517129624053176209317803996258765494507830461827232470354860208145;
    uint256 constant IC10y = 17209400843262167404655579421362057747358838989942607625780811352132470944752;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[10] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x
                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                
                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))
                
                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))
                
                g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))
                
                g1_mulAccC(_pVk, IC9x, IC9y, calldataload(add(pubSignals, 256)))
                
                g1_mulAccC(_pVk, IC10x, IC10y, calldataload(add(pubSignals, 288)))
                

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F
            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            
            checkField(calldataload(add(_pubSignals, 160)))
            
            checkField(calldataload(add(_pubSignals, 192)))
            
            checkField(calldataload(add(_pubSignals, 224)))
            
            checkField(calldataload(add(_pubSignals, 256)))
            
            checkField(calldataload(add(_pubSignals, 288)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
